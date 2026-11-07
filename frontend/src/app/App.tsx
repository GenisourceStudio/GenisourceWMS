import { useQuery } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { fetchMeta } from '../shared/api/endpoints'
import { AuthProvider } from '../shared/auth/AuthContext'
import { RequireAuth } from '../shared/auth/RequireAuth'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'

export function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AuthenticatedApp />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  )
}

function AuthenticatedApp() {
  const meta = useQuery({ queryKey: ['meta'], queryFn: fetchMeta })

  return (
    <AppShell version={meta.data?.version}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/skus" element={<PlaceholderPage navKey="nav.skus" />} />
        <Route path="/locations" element={<PlaceholderPage navKey="nav.skus" />} />
        <Route path="/inbound-orders" element={<PlaceholderPage navKey="nav.inbound" />} />
        <Route path="/outbound-orders" element={<PlaceholderPage navKey="nav.outbound" />} />
        <Route path="/inventory" element={<PlaceholderPage navKey="nav.inventory" />} />
        <Route path="/inventory/transactions" element={<PlaceholderPage navKey="nav.transactions" />} />
        <Route path="/operation-logs" element={<PlaceholderPage navKey="nav.logs" />} />
        {/* PRD: no dedicated 404 page. Unknown paths fall back to the dashboard. */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
