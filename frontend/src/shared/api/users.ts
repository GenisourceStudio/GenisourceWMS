/** User administration endpoints (C2). */
import { apiGet, apiPost, apiPut } from './http'

export interface UserAccount {
  id: number
  username: string
  displayName: string
  enabled: boolean
  roles: string[]
  createdAt: string
}

export interface CreateUserInput {
  username: string
  password: string
  displayName: string
  roleCode: string
}

export interface UpdateUserInput {
  displayName: string
  enabled: boolean
  roleCode: string
}

export function fetchUsers(): Promise<UserAccount[]> {
  return apiGet<UserAccount[]>('/api/v1/users')
}

export function createUser(input: CreateUserInput): Promise<UserAccount> {
  return apiPost<UserAccount>('/api/v1/users', input)
}

export function updateUser(id: number, input: UpdateUserInput): Promise<UserAccount> {
  return apiPut<UserAccount>(`/api/v1/users/${id}`, input)
}

export function changeUserPassword(id: number, newPassword: string): Promise<void> {
  return apiPut<void>(`/api/v1/users/${id}/password`, { newPassword })
}
