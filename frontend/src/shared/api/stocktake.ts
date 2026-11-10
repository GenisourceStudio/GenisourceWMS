/** Stocktake endpoints (A 类). */
import { apiDelete, apiGet, apiPost, type Page } from './http'

export interface StocktakeLine {
  id: number
  skuId: number
  skuCode: string
  skuName: string
  expectedQty: number
  actualQty: number | null
  status: 'PENDING' | 'DONE'
  confirmedAt: string | null
}

export interface StocktakeOrder {
  id: number
  orderNo: string
  locationId: number
  locationCode: string
  status: 'DRAFT' | 'PARTIAL' | 'COMPLETED'
  remark: string | null
  createdBy: number | null
  createdAt: string
  completedAt: string | null
  lines: StocktakeLine[]
}

export interface ConfirmStocktakeResult {
  lineId: number
  status: string
  delta: number
  qtyAfter: number
  orderStatus: string
}

export function fetchStocktakes(status?: string, page = 0, size = 20): Promise<Page<StocktakeOrder>> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  params.set('size', String(size))
  return apiGet<Page<StocktakeOrder>>(`/api/v1/stocktakes?${params}`)
}

export function fetchStocktake(id: number): Promise<StocktakeOrder> {
  return apiGet<StocktakeOrder>(`/api/v1/stocktakes/${id}`)
}

export function createStocktake(locationId: number, remark?: string): Promise<StocktakeOrder> {
  return apiPost<StocktakeOrder>('/api/v1/stocktakes', { locationId, remark })
}

export function confirmStocktakeLine(
  orderId: number,
  lineId: number,
  actualQty: number,
): Promise<ConfirmStocktakeResult> {
  return apiPost<ConfirmStocktakeResult>(
    `/api/v1/stocktakes/${orderId}/lines/${lineId}/confirm`,
    { actualQty },
  )
}

export function deleteStocktake(id: number): Promise<void> {
  return apiDelete(`/api/v1/stocktakes/${id}`)
}
