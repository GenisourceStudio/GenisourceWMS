/** Location master data endpoints. */
import { apiGet, apiPost, apiPut, type Page } from './http'

export interface Location {
  id: number
  code: string
  area: string | null
  remark: string | null
  isActive: boolean
}

export interface LocationInput {
  code?: string
  area?: string
  remark?: string
  isActive?: boolean
}

export function fetchLocations(keyword?: string): Promise<Page<Location>> {
  const query = keyword && keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : ''
  return apiGet<Page<Location>>(`/api/v1/locations${query}`)
}

export function createLocation(input: LocationInput): Promise<Location> {
  return apiPost<Location>('/api/v1/locations', input)
}

export function updateLocation(id: number, input: LocationInput): Promise<Location> {
  return apiPut<Location>(`/api/v1/locations/${id}`, input)
}
