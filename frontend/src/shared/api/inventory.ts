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

export function fetchInventory(keyword?: string, skuId?: number, locationId?: number): Promise<Page<InventoryItem>> {
  const params = new URLSearchParams()
  if (keyword?.trim()) params.set('keyword', keyword.trim())
  if (skuId != null) params.set('skuId', String(skuId))
  if (locationId != null) params.set('locationId', String(locationId))
  const query = params.toString() ? `?${params}` : ''
  return apiGet<Page<InventoryItem>>(`/api/v1/inventory${query}`)
}

export function fetchTransactions(filters?: {
  orderNo?: string
  skuId?: number
  type?: string
}): Promise<Page<InventoryTxnItem>> {
  const params = new URLSearchParams()
  if (filters?.orderNo?.trim()) params.set('orderNo', filters.orderNo.trim())
  if (filters?.skuId != null) params.set('skuId', String(filters.skuId))
  if (filters?.type) params.set('type', filters.type)
  const query = params.toString() ? `?${params}` : ''
  return apiGet<Page<InventoryTxnItem>>(`/api/v1/inventory/transactions${query}`)
}
