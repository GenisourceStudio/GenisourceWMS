/**
 * Auth endpoints. Types mirror the backend DTOs (docs/SYSTEM_DESIGN.md §6).
 */
import { apiGet, apiPost } from './http'

export interface UserSummary {
  id: number
  username: string
  displayName: string
  permissions: string[]
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  user: UserSummary
}

export function login(username: string, password: string): Promise<TokenResponse> {
  return apiPost<TokenResponse>('/api/v1/auth/login', { username, password })
}

export function fetchMe(): Promise<UserSummary> {
  return apiGet<UserSummary>('/api/v1/auth/me')
}

export function logout(): Promise<void> {
  return apiPost<void>('/api/v1/auth/logout', {})
}
