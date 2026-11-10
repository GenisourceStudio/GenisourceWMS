#!/usr/bin/env node
/**
 * 统一验收（Slice 0–8 + B/C/A 扩展），docs/SYSTEM_DESIGN.md §11。
 * 需在空库上运行；覆盖：登录鉴权、主数据、入库上架（含批次）、出库 FEFO、
 * 盘点、调拨、用户管理、组合筛选、单据编辑/删除。
 */
const BASE = process.env.WMS_API ?? 'http://localhost:8101/api/v1'
let passed = 0, failed = 0
const check = (n, c, x = '') => {
  console.log(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`)
  c ? passed++ : failed++
}
async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let data = null
  try { data = await res.json() } catch { /* 204 */ }
  return { status: res.status, data }
}
const code = (r) => r.data?.code

async function main() {
  // ---------- 鉴权 ----------
  const login = await req('POST', '/auth/login', { username: 'admin', password: 'admin123' })
  check('登录成功', login.status === 200 && !!login.data?.accessToken)
  const T = login.data.accessToken
  check('admin 含 MANAGE_USER 权限', login.data.user.permissions.includes('MANAGE_USER'))
  check('错误密码 401', (await req('POST', '/auth/login', { username: 'admin', password: 'x' })).status === 401)
  check('未登录访问受保护接口 401', (await req('GET', '/skus')).status === 401)

  // ---------- 主数据 ----------
  const mk = async (p, b) => (await req('POST', p, b, T)).data
  const sku1 = await mk('/skus', { code: 'ACC-SKU-1', name: '验收商品A', unit: '件' })
  const sku2 = await mk('/skus', { code: 'ACC-SKU-2', name: '验收商品B', unit: '箱' })
  const loc1 = await mk('/locations', { code: 'ACC-A-01' })
  const loc2 = await mk('/locations', { code: 'ACC-A-02' })
  const sup = await mk('/partners', { code: 'ACC-SUP', name: '验收供应商', type: 'SUPPLIER' })
  const cus = await mk('/partners', { code: 'ACC-CUS', name: '验收客户', type: 'CUSTOMER' })
  check('主数据创建（2 SKU/2 库位/供应商/客户）', [sku1, sku2, loc1, loc2, sup, cus].every((x) => x && x.id))
  check('重复 SKU 编码 409', (await req('POST', '/skus', { code: 'ACC-SKU-1', name: 'dup' }, T)).status === 409)

  // ---------- 入库（含批次） ----------
  const inOrder = (await req('POST', '/inbound-orders', {
    partnerId: sup.id, remark: '验收入库',
    lines: [{ skuId: sku1.id, expectedQty: 20 }, { skuId: sku2.id, expectedQty: 5 }],
  }, T)).data
  check('建入库单（RK- 单号）', /^RK-\d{8}-\d{4}$/.test(inOrder.orderNo))
  const [l1, l2] = inOrder.lines.map((l) => l.id)
  check('错扫 SKU 409', code(await req('POST', `/inbound-orders/${inOrder.id}/lines/${l1}/confirm`,
    { skuCode: 'ACC-SKU-2', locationCode: 'ACC-A-01', qty: 20, clientToken: 'i1' }, T)) === 'SKU_MISMATCH')
  const c1 = await req('POST', `/inbound-orders/${inOrder.id}/lines/${l1}/confirm`,
    { skuCode: 'ACC-SKU-1', locationCode: 'ACC-A-01', qty: 20, clientToken: 'i1', batchNo: 'LOT-A', expiryDate: '2026-12-31' }, T)
  check('行1 带批次上架 + 库存 20', c1.status === 200 && c1.data.qtyAfter === 20)
  const replay = await req('POST', `/inbound-orders/${inOrder.id}/lines/${l1}/confirm`,
    { skuCode: 'ACC-SKU-1', locationCode: 'ACC-A-01', qty: 20, clientToken: 'i1', batchNo: 'LOT-A' }, T)
  check('相同 token 幂等重放 200', replay.status === 200 && replay.data.qtyAfter === 20)
  const c2 = await req('POST', `/inbound-orders/${inOrder.id}/lines/${l2}/confirm`,
    { skuCode: 'ACC-SKU-2', locationCode: 'ACC-A-02', qty: 5, clientToken: 'i2' }, T)
  check('行2 完成后单据 COMPLETED', c2.data.orderStatus === 'COMPLETED')

  // ---------- 出库 FEFO ----------
  const outOrder = (await req('POST', '/outbound-orders', {
    partnerId: cus.id, lines: [{ skuId: sku1.id, expectedQty: 8 }],
  }, T)).data
  check('建出库单（CK- 单号）', /^CK-\d{8}-\d{4}$/.test(outOrder.orderNo))
  const ol = outOrder.lines[0].id
  const task = await req('GET', `/outbound-orders/${outOrder.id}/task`, null, T)
  const pick = task.data.lines[0].pickLocations[0]
  check('拣货指引带批次（FEFO）', pick && pick.batchNo === 'LOT-A', `batch=${pick?.batchNo}`)
  check('超量建单 409', (await req('POST', '/outbound-orders', { partnerId: cus.id, lines: [{ skuId: sku1.id, expectedQty: 999 }] }, T)).status === 409)
  const oc = await req('POST', `/outbound-orders/${outOrder.id}/lines/${ol}/confirm`,
    { skuCode: 'ACC-SKU-1', locationCode: 'ACC-A-01', qty: 8, clientToken: 'o1', batchNo: 'LOT-A' }, T)
  check('复核扣减 qtyAfter=12', oc.data.qtyAfter === 12)

  // ---------- 盘点 ----------
  const st = (await req('POST', '/stocktakes', { locationId: loc2.id, remark: '验收盘点' }, T)).data
  check('建盘点单（PD- 单号，快照库存）', /^PD-\d{8}-\d{4}$/.test(st.orderNo) && st.lines.length === 1, `${st.lines?.[0]?.skuCode} 账面 ${st.lines?.[0]?.expectedQty}`)
  const stLine = st.lines[0]
  const stc = await req('POST', `/stocktakes/${st.id}/lines/${stLine.id}/confirm`, { actualQty: 2 }, T)
  check('盘点盘亏（账面5→实盘2，delta=-3）', stc.data.delta === -3 && stc.data.qtyAfter === 2)

  // ---------- 调拨 ----------
  const tr = (await req('POST', '/transfers', {
    lines: [{ skuId: sku1.id, fromLocationId: loc1.id, toLocationId: loc2.id, qty: 4 }],
  }, T)).data
  check('建调拨单（DB- 单号）', /^DB-\d{8}-\d{4}$/.test(tr.orderNo))
  // loc2 held no ACC-SKU-1 before (its stock is ACC-SKU-2), so the target goes
  // 0 -> 4 and the source 12 -> 8. Net stock is unchanged.
  const trc = await req('POST', `/transfers/${tr.id}/lines/${tr.lines[0].id}/confirm`, { clientToken: 't1' }, T)
  check('调拨确认（源12→8，目标0→4）', trc.data.qtyAfterFrom === 8 && trc.data.qtyAfterTo === 4,
    `${trc.data.qtyAfterFrom}->${trc.data.qtyAfterTo}`)

  // ---------- 用户管理 ----------
  const u = await req('POST', '/users', { username: 'acc_op', password: 'worker123', displayName: '验收作业员', roleCode: 'OPERATOR' }, T)
  check('创建作业员 201', u.status === 201)
  check('作业员访问用户管理 403', (await req('GET', '/users', null, (await req('POST', '/auth/login', { username: 'acc_op', password: 'worker123' })).data.accessToken)).status === 403)
  check('不能禁用自己 409', code(await req('PUT', '/users/1', { displayName: '管理员', enabled: false, roleCode: 'ADMIN' }, T)) === 'CANNOT_DISABLE_SELF')

  // ---------- 组合筛选 + 分页 ----------
  check('流水按类型筛选', (await req('GET', '/inventory/transactions?type=ADJUST', null, T)).data.total === 1)
  check('流水日期筛选（未来 0）', (await req('GET', '/inventory/transactions?from=2030-01-01', null, T)).data.total === 0)
  check('低库存筛选生效', (await req('GET', '/inventory?lowStockOnly=true&threshold=5', null, T)).status === 200)
  check('日志按操作人筛选', (await req('GET', '/operation-logs?actor=' + encodeURIComponent('管理员'), null, T)).data.total > 0)
  check('分页 size=1 只返回 1 条', (await req('GET', '/inventory/transactions?page=0&size=1', null, T)).data.items.length === 1)

  // ---------- 单据编辑/删除 ----------
  const draft = (await req('POST', '/inbound-orders', { partnerId: sup.id, lines: [{ skuId: sku1.id, expectedQty: 1 }] }, T)).data
  check('草稿可编辑', (await req('PUT', `/inbound-orders/${draft.id}`, { partnerId: sup.id, remark: 'edited', lines: [{ skuId: sku1.id, expectedQty: 2 }] }, T)).status === 200)
  check('草稿可删除 204', (await req('DELETE', `/inbound-orders/${draft.id}`, null, T)).status === 204)
  check('已完成单据不可删 409', code(await req('DELETE', `/inbound-orders/${inOrder.id}`, null, T)) === 'ORDER_NOT_DELETABLE')

  console.log('\n' + '='.repeat(52))
  console.log(`结果：${passed} 通过 / ${failed} 失败`)
  if (failed > 0) process.exit(1)
}
main().catch((e) => { console.error('验收异常：', e); process.exit(1) })
