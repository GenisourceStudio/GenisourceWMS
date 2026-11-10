/** Inbound order endpoints. */
import { apiDelete, apiGet, apiPost, apiPut, type Page } from './http'

export type OrderStatus = 'DRAFT' | 'PARTIAL' | 'COMPLETED'

export interface OrderLine {
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

export interface InboundOrder {
  id: number
  orderNo: string
  partnerId: number
  partnerName: string
  status: OrderStatus
  remark: string | null
  createdAt: string
  completedAt: string | null
  lines: OrderLine[]
}

export interface CreateInboundInput {
  partnerId: number
  remark?: string
  lines: { skuId: number; expectedQty: number }[]
}

export function fetchInboundOrders(status?: string, page = 0, size = 20): Promise<Page<InboundOrder>> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  params.set('size', String(size))
  return apiGet<Page<InboundOrder>>(`/api/v1/inbound-orders?${params}`)
}

export function fetchInboundOrder(id: number): Promise<InboundOrder> {
  return apiGet<InboundOrder>(`/api/v1/inbound-orders/${id}`)
}

export function createInboundOrder(input: CreateInboundInput): Promise<InboundOrder> {
  return apiPost<InboundOrder>('/api/v1/inbound-orders', input)
}

/** Only DRAFT orders can be edited; partner stays immutable on the backend. */
export function updateInboundOrder(id: number, input: CreateInboundInput): Promise<InboundOrder> {
  return apiPut<InboundOrder>(`/api/v1/inbound-orders/${id}`, input)
}

export function deleteInboundOrder(id: number): Promise<void> {
  return apiDelete(`/api/v1/inbound-orders/${id}`)
}
