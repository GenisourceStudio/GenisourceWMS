/** Stock transfer endpoints (A 类). */
import { apiDelete, apiGet, apiPost, type Page } from './http'

export interface TransferLine {
  id: number
  skuId: number
  skuCode: string
  fromLocationId: number
  fromLocationCode: string
  toLocationId: number
  toLocationCode: string
  qty: number
  status: 'PENDING' | 'DONE'
}

export interface TransferOrder {
  id: number
  orderNo: string
  status: 'DRAFT' | 'PARTIAL' | 'COMPLETED'
  remark: string | null
  createdBy: number | null
  createdAt: string
  completedAt: string | null
  lines: TransferLine[]
}

export interface CreateTransferInput {
  remark?: string
  lines: { skuId: number; fromLocationId: number; toLocationId: number; qty: number }[]
}

export interface ConfirmTransferResult {
  lineId: number
  lineStatus: string
  orderStatus: string
  qtyAfterFrom: number
  qtyAfterTo: number
}

export function fetchTransfers(status?: string, page = 0, size = 20): Promise<Page<TransferOrder>> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  params.set('size', String(size))
  return apiGet<Page<TransferOrder>>(`/api/v1/transfers?${params}`)
}

export function createTransfer(input: CreateTransferInput): Promise<TransferOrder> {
  return apiPost<TransferOrder>('/api/v1/transfers', input)
}

export function confirmTransferLine(
  orderId: number,
  lineId: number,
  clientToken: string,
): Promise<ConfirmTransferResult> {
  return apiPost<ConfirmTransferResult>(
    `/api/v1/transfers/${orderId}/lines/${lineId}/confirm`,
    { clientToken },
  )
}

export function deleteTransfer(id: number): Promise<void> {
  return apiDelete(`/api/v1/transfers/${id}`)
}

export function fetchTransfer(id: number): Promise<TransferOrder> {
  return apiGet<TransferOrder>(`/api/v1/transfers/${id}`)
}
