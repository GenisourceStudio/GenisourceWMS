/**
 * SKU master data endpoints (docs/SYSTEM_DESIGN.md §6).
 */
import { apiGet, apiPost, apiPut } from './http'

export interface Sku {
  id: number
  code: string
  name: string
  spec: string | null
  unit: string | null
  isActive: boolean
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface CreateSkuInput {
  code: string
  name: string
  spec?: string
  unit?: string
}

export interface UpdateSkuInput {
  name: string
  spec?: string
  unit?: string
  isActive: boolean
}

export function fetchSkus(keyword?: string): Promise<Page<Sku>> {
  const query = keyword && keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : ''
  return apiGet<Page<Sku>>(`/api/v1/skus${query}`)
}

export function createSku(input: CreateSkuInput): Promise<Sku> {
  return apiPost<Sku>('/api/v1/skus', input)
}

export function updateSku(id: number, input: UpdateSkuInput): Promise<Sku> {
  return apiPut<Sku>(`/api/v1/skus/${id}`, input)
}
