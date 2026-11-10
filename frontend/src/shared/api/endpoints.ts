/**
 * One function per endpoint. Types mirror the backend DTOs and the contracts in
 * docs/SYSTEM_DESIGN.md §6.
 */
import { apiGet } from './http'

export interface Meta {
  version: string
  timeZone: string
  locales: string[]
}

/** Public build metadata; used by the shell footer before a login exists. */
export function fetchMeta(): Promise<Meta> {
  return apiGet<Meta>('/api/v1/meta')
}

export interface HealthSummary {
  status: string
}

export function fetchHealth(): Promise<HealthSummary> {
  return apiGet<HealthSummary>('/actuator/health')
}

export interface DashboardSummary {
  pendingOrders: number
  todayInbound: number
  todayOutbound: number
  stockTotal: number
}

/** KPI tiles in the dashboard Hero — all four come from real DB queries. */
export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>('/api/v1/dashboard/summary')
}
