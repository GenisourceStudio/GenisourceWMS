#!/usr/bin/env node
/**
 * Ledger consistency check (docs/SYSTEM_DESIGN.md §11.3).
 *
 * Verifies, for every (sku, location):
 *   1. inventory.qty == SUM(inventory_txn.qty_delta)
 *   2. qty >= 0
 *   3. the last ledger row's qty_after == inventory.qty
 *
 * Also checks that every confirmed order line has exactly one ledger row.
 *
 * Uses the `psql` CLI through docker exec so the project gains no new runtime
 * dependency. Configuration mirrors .env.example; override with env vars.
 *
 * Usage: node scripts/check-ledger.mjs
 */
import { execFileSync } from 'node:child_process'

const CONTAINER = process.env.WMS_DB_CONTAINER ?? 'genisource-wms-db-dev'
const DB_USER = process.env.DB_USER ?? 'wms'
const DB_NAME = process.env.DB_NAME ?? 'genisource_wms'

function sql(statement) {
  const out = execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tA', '-F', '\t', '-c', statement],
    { encoding: 'utf8' },
  )
  return out.trim().split('\n').filter(Boolean).map((line) => line.split('\t'))
}

function fail(message) {
  console.error(`❌ ${message}`)
  process.exitCode = 1
}

// --- 1. qty == SUM(delta), and qty >= 0 -------------------------------------
const qtyRows = sql(`
  SELECT i.sku_id, i.location_id, i.qty,
         COALESCE(SUM(t.qty_delta), 0) AS sum_delta
  FROM inventory i
  LEFT JOIN inventory_txn t
    ON t.sku_id = i.sku_id AND t.location_id = i.location_id
  GROUP BY i.sku_id, i.location_id, i.qty
  ORDER BY i.sku_id, i.location_id
`)

console.log(`检查 ${qtyRows.length} 个 (SKU, 库位) 组合…`)
let ok = true
for (const [skuId, locationId, qty, sumDelta] of qtyRows) {
  const q = Number(qty)
  const sum = Number(sumDelta)
  if (q < 0) {
    fail(`库存为负：sku=${skuId} location=${locationId} qty=${q}`)
    ok = false
  }
  if (q !== sum) {
    fail(`账实不符：sku=${skuId} location=${locationId} qty=${q} 但 SUM(delta)=${sum}`)
    ok = false
  }
}

// --- 2. last qty_after == current qty ---------------------------------------
const afterRows = sql(`
  SELECT DISTINCT ON (sku_id, location_id)
         sku_id, location_id, qty_after
  FROM inventory_txn
  ORDER BY sku_id, location_id, occurred_at DESC, id DESC
`)
const inventoryMap = new Map(qtyRows.map(([s, l, q]) => [`${s}:${l}`, Number(q)]))
for (const [skuId, locationId, qtyAfter] of afterRows) {
  const current = inventoryMap.get(`${skuId}:${locationId}`)
  if (current !== undefined && Number(qtyAfter) !== current) {
    fail(`最后一笔流水 qty_after=${qtyAfter} 与当前库存 ${current} 不符：sku=${skuId} location=${locationId}`)
    ok = false
  }
}

// --- 3. every confirmed line has >=1 ledger row, and the sum matches --------
// Since V4 a single line may produce several rows (one per batch under FEFO),
// so "exactly one" no longer holds. The signed sum must still equal the line's
// confirmed quantity (positive for inbound, negative for outbound).
const lineRows = sql(`
  SELECT 'INBOUND', id, confirmed_qty FROM inbound_line WHERE status = 'DONE'
  UNION ALL
  SELECT 'OUTBOUND', id, confirmed_qty FROM outbound_line WHERE status = 'DONE'
`)
const txnRows = sql(`SELECT order_type, line_id, COUNT(*), SUM(qty_delta) FROM inventory_txn GROUP BY order_type, line_id`)
const txnCount = new Map(txnRows.map(([type, lineId, count]) => [`${type}:${lineId}`, Number(count)]))
const txnSum = new Map(txnRows.map(([type, lineId, , sum]) => [`${type}:${lineId}`, Number(sum)]))
for (const [type, lineId, confirmedQty] of lineRows) {
  const key = `${type}:${lineId}`
  const count = txnCount.get(key) ?? 0
  const sum = txnSum.get(key) ?? 0
  const expected = type === 'INBOUND' ? Number(confirmedQty) : -Number(confirmedQty)
  if (count < 1) {
    fail(`已完成行 ${type}#${lineId} 没有流水`)
    ok = false
  }
  if (sum !== expected) {
    fail(`已完成行 ${type}#${lineId} 流水合计 ${sum} 与应记账 ${expected} 不符`)
    ok = false
  }
}
console.log(`检查 ${lineRows.length} 条已完成单据行…`)

// --- 4. no orphan ledger rows ------------------------------------------------
// Only INBOUND / OUTBOUND rows reference order lines. STOCKTAKE / TRANSFER
// rows reference their own tables (V4).
const orphans = sql(`
  SELECT t.order_type, t.line_id
  FROM inventory_txn t
  LEFT JOIN inbound_line il ON t.order_type = 'INBOUND' AND il.id = t.line_id
  LEFT JOIN outbound_line ol ON t.order_type = 'OUTBOUND' AND ol.id = t.line_id
  LEFT JOIN stocktake_line sl ON t.order_type = 'STOCKTAKE' AND sl.id = t.line_id
  LEFT JOIN transfer_line tl ON t.order_type = 'TRANSFER' AND tl.id = t.line_id
  WHERE (t.order_type = 'INBOUND' AND il.id IS NULL)
     OR (t.order_type = 'OUTBOUND' AND ol.id IS NULL)
     OR (t.order_type = 'STOCKTAKE' AND sl.id IS NULL)
     OR (t.order_type = 'TRANSFER' AND tl.id IS NULL)
`)
if (orphans.length > 0) {
  fail(`发现 ${orphans.length} 条孤儿流水（对应行不存在）：${orphans.map((r) => r.join('#')).join(', ')}`)
  ok = false
}

if (ok) {
  console.log('✅ 账实一致：库存、流水、单据行全部吻合')
} else {
  console.error('账实一致性校验失败')
  process.exit(1)
}
