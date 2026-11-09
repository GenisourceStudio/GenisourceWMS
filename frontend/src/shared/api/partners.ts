/** Partner (supplier / customer) master data endpoints. */
import { apiGet, apiPost, apiPut, type Page } from './http'

export type PartnerType = 'SUPPLIER' | 'CUSTOMER'

export interface Partner {
  id: number
  code: string
  name: string
  type: PartnerType
  contact: string | null
  isActive: boolean
}

export interface PartnerInput {
  code?: string
  name?: string
  type?: PartnerType
  contact?: string
  isActive?: boolean
}

export function fetchPartners(type?: PartnerType, keyword?: string): Promise<Page<Partner>> {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (keyword && keyword.trim()) params.set('keyword', keyword.trim())
  const query = params.toString() ? `?${params}` : ''
  return apiGet<Page<Partner>>(`/api/v1/partners${query}`)
}

export function createPartner(input: PartnerInput): Promise<Partner> {
  return apiPost<Partner>('/api/v1/partners', input)
}

export function updatePartner(id: number, input: PartnerInput): Promise<Partner> {
  return apiPut<Partner>(`/api/v1/partners/${id}`, input)
}
