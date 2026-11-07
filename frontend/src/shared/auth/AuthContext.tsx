import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, clearTokens, getAccessToken, getRefreshToken, setRefreshHandler, storeTokens } from '../api/http'
import { fetchMe, login as loginRequest, type UserSummary } from '../api/auth'

interface AuthState {
  user: UserSummary | null
  /** True until the stored session has been checked against the backend. */
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Holds the session for the SPA. Tokens live in localStorage (shared with
 * http.ts); the user object is re-fetched from /auth/me on mount so a token
 * that was revoked or a user that was disabled does not survive a page reload.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Let http.ts replay a request once after refreshing an expired access token.
  useEffect(() => {
    setRefreshHandler(async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        return null
      }
      try {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!response.ok) {
          clearTokens()
          setUser(null)
          return null
        }
        const data = (await response.json()) as { accessToken: string; refreshToken: string }
        storeTokens(data.accessToken, data.refreshToken)
        return data.accessToken
      } catch {
        clearTokens()
        setUser(null)
        return null
      }
    })
    return () => setRefreshHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!getAccessToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await fetchMe()
        if (!cancelled) {
          setUser(me)
        }
      } catch (error) {
        // An expired or revoked token is not an error state, just a logged-out one.
        if (error instanceof ApiError) {
          clearTokens()
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await loginRequest(username, password)
    storeTokens(tokens.accessToken, tokens.refreshToken)
    setUser(tokens.user)
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}

/** Capability check used to hide actions the account cannot perform. */
export function useHasPermission(code: string): boolean {
  const { user } = useAuth()
  return user?.permissions.includes(code) ?? false
}
