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
