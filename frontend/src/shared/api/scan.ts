/** Mobile scan-job endpoints. */
import { apiGet, apiPost } from './http'
import type { InboundOrder } from './orders'

export interface ConfirmResult {
  lineId: number
  lineStatus: string
  qtyAfter: number
  orderStatus: string
}

export function fetchInboundTask(id: number): Promise<InboundOrder> {
  return apiGet<InboundOrder>(`/api/v1/inbound-orders/${id}/task`)
}

export function confirmInboundLine(
  id: number,
  lineId: number,
  input: {
    skuCode: string
    locationCode: string
    qty: number
    clientToken: string
    batchNo?: string
    expiryDate?: string
  },
): Promise<ConfirmResult> {
  return apiPost<ConfirmResult>(`/api/v1/inbound-orders/${id}/lines/${lineId}/confirm`, input)
}
