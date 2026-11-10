/** Inventory read endpoints. */
import { apiGet, type Page } from './http'

export interface InventoryItem {
  skuId: number
  skuCode: string
  skuName: string
  locationId: number
  locationCode: string
  qty: number
  updatedAt: string
}

export interface InventoryTxnItem {
  id: number
  occurredAt: string
  type: 'INBOUND' | 'OUTBOUND'
  skuCode: string
  locationCode: string
  qtyDelta: number
  qtyAfter: number
  orderNo: string
  lineId: number
  operatorName: string
}

export interface InventoryQuery {
  keyword?: string
  skuId?: number
  locationId?: number
  lowStockOnly?: boolean
  threshold?: number
  page?: number
  size?: number
}

export interface TxnQuery {
  orderNo?: string
  skuId?: number
  /** Kept as a string because it comes straight from the filter input. */
  locationId?: string | number
  type?: string
  from?: string
  to?: string
  page?: number
  size?: number
}

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) {
      q.set(key, String(value))
    }
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function fetchInventory(query: InventoryQuery = {}): Promise<Page<InventoryItem>> {
  return apiGet<Page<InventoryItem>>(`/api/v1/inventory${queryString({
    keyword: query.keyword?.trim() || undefined,
    skuId: query.skuId,
    locationId: query.locationId,
    lowStockOnly: query.lowStockOnly,
    threshold: query.threshold,
    page: query.page,
    size: query.size,
  })}`)
}

export function fetchTransactions(query: TxnQuery = {}): Promise<Page<InventoryTxnItem>> {
  return apiGet<Page<InventoryTxnItem>>(`/api/v1/inventory/transactions${queryString({
    orderNo: query.orderNo?.trim() || undefined,
    skuId: query.skuId,
    locationId: query.locationId,
    type: query.type,
    from: query.from,
    to: query.to,
    page: query.page,
    size: query.size,
  })}`)
}
