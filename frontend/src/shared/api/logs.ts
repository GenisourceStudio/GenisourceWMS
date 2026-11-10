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

export interface LogQuery {
  action?: string
  actor?: string
  from?: string
  to?: string
  page?: number
  size?: number
}

export function fetchOperationLogs(query: LogQuery = {}): Promise<Page<OperationLogItem>> {
  const q = new URLSearchParams()
  if (query.action?.trim()) q.set('action', query.action.trim())
  if (query.actor?.trim()) q.set('actor', query.actor.trim())
  if (query.from) q.set('from', query.from)
  if (query.to) q.set('to', query.to)
  if (query.page !== undefined) q.set('page', String(query.page))
  if (query.size !== undefined) q.set('size', String(query.size))
  const s = q.toString()
  return apiGet<Page<OperationLogItem>>(`/api/v1/operation-logs${s ? `?${s}` : ''}`)
}
