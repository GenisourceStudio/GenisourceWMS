import i18n from '../i18n'

const ACCESS_KEY = 'genisource.wms.access'
const REFRESH_KEY = 'genisource.wms.refresh'

/** RFC 9457 problem detail, plus the WMS-specific `code` extension property. */
/** Envelope for paged lists — the same shape for every resource. */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface Problem {
  status?: number
  title?: string
  detail?: string
  code?: string
  errors?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem?: Problem

  constructor(status: number, detail?: string, problem?: Problem) {
    super(detail ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }

  /** The stable machine-readable code the UI switches on (e.g. SKU_MISMATCH). */
  get code(): string | undefined {
    return this.problem?.code
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

let refreshHandler: (() => Promise<string | null>) | null = null

/** Registered by AuthProvider; returns the new access token, or null if the session ended. */
export function setRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  refreshHandler = handler
}

async function parseProblem(response: Response): Promise<Problem | undefined> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    return undefined
  }
  try {
    return (await response.json()) as Problem
  } catch {
    return undefined
  }
}

async function performFetch(path: string, init: RequestInit, retried = false): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Accept-Language', i18n.language)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, i18n.t('common.networkError'))
  }

  // A short-lived access token expiring mid-task must not interrupt scanning:
  // refresh once and replay the request.
  if (response.status === 401 && !retried) {
    const nextToken = refreshHandler ? await refreshHandler() : null
    if (nextToken) {
      return performFetch(path, init, true)
    }
  }
  return response
}

async function requestWithToken<T>(path: string, init: RequestInit, retried = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  const response = await performFetch(path, { ...init, headers }, retried)

  if (!response.ok) {
    const problem = await parseProblem(response)
    throw new ApiError(
      response.status,
      problem?.detail ?? problem?.title ?? response.statusText,
      problem,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function apiGet<T>(path: string): Promise<T> {
  return requestWithToken<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return requestWithToken<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return requestWithToken<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function apiDelete(path: string): Promise<void> {
  return requestWithToken<void>(path, { method: 'DELETE' })
}
