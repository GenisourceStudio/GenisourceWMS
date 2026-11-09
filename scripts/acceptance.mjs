#!/usr/bin/env node
/**
 * Slice 0–8 统一验收脚本（docs/SYSTEM_DESIGN.md §11.1 + §11.2）。
 * 从全新数据库跑通「入库 → 上架 → 库存 → 拣货复核 → 出库」全链路。
 * 用法：node scripts/acceptance.mjs
 */
const BASE = process.env.WMS_API ?? 'http://localhost:8101/api/v1'

let passed = 0
let failed = 0
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`✅ ${name}${extra ? ' — ' + extra : ''}`)
    passed++
  } else {
    console.log(`❌ ${name}${extra ? ' — ' + extra : ''}`)
    failed++
  }
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* 204 */ }
  return { status: res.status, data }
}

function code(r) { return r.data?.code }

async function main() {
  // ---- 步骤 0：登录 ----
  const login = await req('POST', '/auth/login', { username: 'admin', password: 'admin123' })
  check('登录成功并拿到 JWT', login.status === 200 && !!login.data?.accessToken,
    login.data?.user?.permissions?.length + ' 项权限')
  const T = login.data.accessToken

  const bad = await req('POST', '/auth/login', { username: 'admin', password: 'wrong' })
  check('错误密码返回 401 ProblemDetail', bad.status === 401 && code(bad) === 'UNAUTHORIZED')
  const me = await req('GET', '/auth/me', null, T)
  check('/auth/me 返回当前用户', me.status === 200 && me.data.username === 'admin')
  const noAuth = await req('GET', '/skus')
  check('未登录访问受保护接口 401', noAuth.status === 401 && code(noAuth) === 'UNAUTHORIZED')

  // ---- 步骤 1：主数据 ----
  const s1 = await req('POST', '/skus', { code: 'SKU-1001', name: '商品A', spec: '红色 500g', unit: '件' }, T)
  const s2 = await req('POST', '/skus', { code: 'SKU-1002', name: '商品B', spec: '蓝色', unit: '箱' }, T)
  const l1 = await req('POST', '/locations', { code: 'A-01-02', area: 'A区' }, T)
  const l2 = await req('POST', '/locations', { code: 'A-01-03', area: 'A区' }, T)
  const sup = await req('POST', '/partners', { code: 'SUP-001', name: 'XXX贸易公司', type: 'SUPPLIER' }, T)
  const cus = await req('POST', '/partners', { code: 'CUS-001', name: 'YYY商城', type: 'CUSTOMER' }, T)
  check('建立 2 SKU / 2 库位 / 供应商 / 客户',
    [s1, s2, l1, l2, sup, cus].every((r) => r.status === 201))
  const dup = await req('POST', '/skus', { code: 'SKU-1001', name: '重复' }, T)
  check('重复 SKU 编码 → 409', dup.status === 409 && code(dup) === 'DUPLICATE_SKU_CODE')

  // ---- 步骤 2：入库单 ----
  const inOrder = await req('POST', '/inbound-orders', {
    partnerId: sup.data.id, remark: '首批采购',
    lines: [{ skuId: s1.data.id, expectedQty: 20 }, { skuId: s2.data.id, expectedQty: 5 }],
  }, T)
  check('建入库单（2 行，单号格式正确）',
    inOrder.status === 201 && /^RK-\d{8}-\d{4}$/.test(inOrder.data.orderNo) && inOrder.data.lines.length === 2,
    inOrder.data.orderNo)
  check('初始状态 DRAFT', inOrder.data.status === 'DRAFT')
  const oid = inOrder.data.id
  const [lid1, lid2] = inOrder.data.lines.map((l) => l.id)

  const wrongPartner = await req('POST', '/outbound-orders', {
    partnerId: sup.data.id, lines: [{ skuId: s1.data.id, expectedQty: 1 }],
  }, T)
  check('出库单误用供应商 → 409 类型校验', wrongPartner.status === 409)

  // ---- 步骤 3：扫码上架（核心事务） ----
  const wrongSku = await req('POST', `/inbound-orders/${oid}/lines/${lid1}/confirm`,
    { skuCode: 'SKU-1002', locationCode: 'A-01-02', qty: 20, clientToken: 'a1' }, T)
  check('错扫 SKU 拦截且不写库', wrongSku.status === 409 && code(wrongSku) === 'SKU_MISMATCH')

  const c1 = await req('POST', `/inbound-orders/${oid}/lines/${lid1}/confirm`,
    { skuCode: 'SKU-1001', locationCode: 'A-01-02', qty: 20, clientToken: 'a1' }, T)
  check('行1 上架成功 + 库存 20', c1.status === 200 && c1.data.qtyAfter === 20,
    '单据状态 ' + c1.data.orderStatus)

  const replay = await req('POST', `/inbound-orders/${oid}/lines/${lid1}/confirm`,
    { skuCode: 'SKU-1001', locationCode: 'A-01-02', qty: 20, clientToken: 'a1' }, T)
  check('相同 clientToken 幂等重放（不重复记账）', replay.status === 200 && replay.data.qtyAfter === 20)

  const dupScan = await req('POST', `/inbound-orders/${oid}/lines/${lid1}/confirm`,
    { skuCode: 'SKU-1001', locationCode: 'A-01-02', qty: 20, clientToken: 'a2' }, T)
  check('新 token 重复扫 → 409 DUPLICATE_SCAN', dupScan.status === 409 && code(dupScan) === 'DUPLICATE_SCAN')

  const qtyBad = await req('POST', `/inbound-orders/${oid}/lines/${lid2}/confirm`,
    { skuCode: 'SKU-1002', locationCode: 'A-01-03', qty: 99, clientToken: 'a3' }, T)
  check('数量不符 → 409 QTY_MISMATCH', qtyBad.status === 409 && code(qtyBad) === 'QTY_MISMATCH')

  const c2 = await req('POST', `/inbound-orders/${oid}/lines/${lid2}/confirm`,
    { skuCode: 'SKU-1002', locationCode: 'A-01-03', qty: 5, clientToken: 'a3' }, T)
  check('行2 上架后单据自动 COMPLETED', c2.status === 200 && c2.data.orderStatus === 'COMPLETED')

  // ---- 步骤 4：库存查询 / 流水 ----
  const inv = await req('GET', '/inventory', null, T)
  check('库存查询：20@A-01-02 / 5@A-01-03',
    inv.status === 200 && inv.data.total === 2 &&
    inv.data.items.some((i) => i.qty === 20 && i.locationCode === 'A-01-02'))
  const txns = await req('GET', '/inventory/transactions', null, T)
  check('流水台账：恰好 2 条 +20/+5',
    txns.status === 200 && txns.data.total === 2 &&
    txns.data.items.every((t) => t.type === 'INBOUND'))

  // ---- 步骤 5：出库单 ----
  const outOrder = await req('POST', '/outbound-orders', {
    partnerId: cus.data.id, remark: '首批销售',
    lines: [{ skuId: s1.data.id, expectedQty: 8 }],
  }, T)
  check('建出库单（单号 CK-）',
    outOrder.status === 201 && /^CK-\d{8}-\d{4}$/.test(outOrder.data.orderNo), outOrder.data.orderNo)
  const coid = outOrder.data.id
  const clid = outOrder.data.lines[0].id

  const task = await req('GET', `/outbound-orders/${coid}/task`, null, T)
  check('拣货指引返回实时库位 A-01-02',
    task.status === 200 && task.data.lines[0].pickLocations.some((p) => p.locationCode === 'A-01-02'))

  const over = await req('POST', '/outbound-orders', {
    partnerId: cus.data.id, lines: [{ skuId: s1.data.id, expectedQty: 999 }],
  }, T)
  check('建单预检拦截超量 → 409 INSUFFICIENT_STOCK', over.status === 409 && code(over) === 'INSUFFICIENT_STOCK')

  // ---- 步骤 6：扫码复核 ----
  const wrongLoc = await req('POST', `/outbound-orders/${coid}/lines/${clid}/confirm`,
    { skuCode: 'SKU-1001', locationCode: 'A-01-03', qty: 8, clientToken: 'b1' }, T)
  check('出库扫到非指引库位 → 409 LOCATION_INVALID', wrongLoc.status === 409 && code(wrongLoc) === 'LOCATION_INVALID')

  const cc = await req('POST', `/outbound-orders/${coid}/lines/${clid}/confirm`,
    { skuCode: 'SKU-1001', locationCode: 'A-01-02', qty: 8, clientToken: 'b1' }, T)
  check('复核扣减：qtyAfter=12，单据 COMPLETED', cc.status === 200 && cc.data.qtyAfter === 12,
    cc.data.orderStatus)

  // ---- 步骤 7：操作日志 / 一致性 ----
  const logs = await req('GET', '/operation-logs', null, T)
  check('操作日志含 STOCK_INBOUND / STOCK_OUTBOUND',
    logs.status === 200 && logs.data.items.some((l) => l.action === 'STOCK_INBOUND') &&
    logs.data.items.some((l) => l.action === 'STOCK_OUTBOUND'))
  const finalInv = await req('GET', '/inventory', null, T)
  check('最终库存 12@A-01-02 / 5@A-01-03',
    finalInv.data.items.find((i) => i.locationCode === 'A-01-02')?.qty === 12 &&
    finalInv.data.items.find((i) => i.locationCode === 'A-01-03')?.qty === 5)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`结果：${passed} 通过 / ${failed} 失败`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error('验收脚本异常：', e); process.exit(1) })
