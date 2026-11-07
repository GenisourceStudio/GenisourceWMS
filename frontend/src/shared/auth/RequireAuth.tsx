import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Blocks rendering until the stored session has been validated. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    // A blank shell beats flashing the login form for one frame on every reload.
    return <div className="boot" aria-busy="true" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
