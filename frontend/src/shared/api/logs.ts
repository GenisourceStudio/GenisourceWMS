/** Operation log endpoints. */
import { apiGet, type Page } from './http'

export interface OperationLogItem {
  id: number
  occurredAt: string
  actorName: string
  action: string
  targetType: string | null
  targetId: number | null
  detailJson: string | null
  ip: string | null
}

export function fetchOperationLogs(action?: string): Promise<Page<OperationLogItem>> {
  const query = action ? `?action=${encodeURIComponent(action)}` : ''
  return apiGet<Page<OperationLogItem>>(`/api/v1/operation-logs${query}`)
}
