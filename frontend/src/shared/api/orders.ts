/** Inbound order endpoints. */
import { apiGet, apiPost, type Page } from './http'

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

export function fetchInboundOrders(status?: string): Promise<Page<InboundOrder>> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiGet<Page<InboundOrder>>(`/api/v1/inbound-orders${query}`)
}

export function fetchInboundOrder(id: number): Promise<InboundOrder> {
  return apiGet<InboundOrder>(`/api/v1/inbound-orders/${id}`)
}

export function createInboundOrder(input: CreateInboundInput): Promise<InboundOrder> {
  return apiPost<InboundOrder>('/api/v1/inbound-orders', input)
}
