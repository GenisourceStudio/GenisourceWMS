/** Outbound order endpoints. */
import { apiGet, apiPost, type Page } from './http'

export type OrderStatus = 'DRAFT' | 'PARTIAL' | 'COMPLETED'

export interface OutboundLine {
  id: number
  skuId: number
  skuCode: string
  skuName: string
  expectedQty: number
  confirmedQty: number
  locationId: number | null
  locationCode: string | null
  status: 'PENDING' | 'DONE'
}

export interface OutboundOrder {
  id: number
  orderNo: string
  partnerId: number
  partnerName: string
  status: OrderStatus
  remark: string | null
  createdAt: string
  completedAt: string | null
  lines: OutboundLine[]
}

export interface PickLocation {
  locationCode: string
  available: number
}

export interface OutboundTask {
  id: number
  orderNo: string
  partnerName: string
  status: string
  lines: {
    id: number
    skuCode: string
    skuName: string
    expectedQty: number
    status: string
    pickLocations: PickLocation[]
  }[]
}

export interface CreateOutboundInput {
  partnerId: number
  remark?: string
  lines: { skuId: number; expectedQty: number }[]
}

export function fetchOutboundOrders(status?: string): Promise<Page<OutboundOrder>> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiGet<Page<OutboundOrder>>(`/api/v1/outbound-orders${query}`)
}

export function fetchOutboundOrder(id: number): Promise<OutboundOrder> {
  return apiGet<OutboundOrder>(`/api/v1/outbound-orders/${id}`)
}

export function createOutboundOrder(input: CreateOutboundInput): Promise<OutboundOrder> {
  return apiPost<OutboundOrder>('/api/v1/outbound-orders', input)
}

export function fetchOutboundTask(id: number): Promise<OutboundTask> {
  return apiGet<OutboundTask>(`/api/v1/outbound-orders/${id}/task`)
}

export function confirmOutboundLine(
  id: number,
  lineId: number,
  input: { skuCode: string; locationCode: string; qty: number; clientToken: string },
): Promise<{ lineId: number; lineStatus: string; qtyAfter: number; orderStatus: string }> {
  return apiPost(`/api/v1/outbound-orders/${id}/lines/${lineId}/confirm`, input)
}
