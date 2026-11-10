import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { fetchTransfer } from '../shared/api/transfer'
import { TableSkeleton, EmptyState } from '../shared/ui/Icon'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { fetchMeta } from '../shared/api/endpoints'
import { AuthProvider } from '../shared/auth/AuthContext'
import { RequireAuth, RequirePermission } from '../shared/auth/RequireAuth'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { MasterdataPage } from '../features/masterdata/MasterdataPage'
import { InboundOrderListPage } from '../features/inbound/InboundOrderListPage'
import { InboundOrderDetailPage } from '../features/inbound/InboundOrderDetailPage'
import { MobileTaskListPage } from '../features/mobile/MobileTaskListPage'
import { InboundJobPage } from '../features/mobile/InboundJobPage'
import { OutboundJobPage } from '../features/mobile/OutboundJobPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { OutboundOrderListPage } from '../features/outbound/OutboundOrderListPage'
import { OutboundOrderDetailPage } from '../features/outbound/OutboundOrderDetailPage'
import { OperationLogPage } from '../features/admin/OperationLogPage'
import { UserListPage } from '../features/admin/UserListPage'
import { TransferPage, TransferDetailPage } from '../features/transfer/TransferPage'
import { StocktakeListPage, StocktakeDetailPage } from '../features/stocktake/StocktakePage'

export function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Mobile jobs render full-screen, outside the PC console shell. */}
        <Route
          path="/m/*"
          element={
            <RequireAuth>
              <MobileRoutes />
            </RequireAuth>
          }
        />
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

function MobileRoutes() {
  return (
    <Routes>
      <Route path="/tasks" element={<RequirePermission permission="EXECUTE_TASK"><MobileTaskListPage /></RequirePermission>} />
      <Route path="/inbound/:id" element={<RequirePermission permission="EXECUTE_TASK"><InboundJobPage /></RequirePermission>} />
      <Route path="/outbound/:id" element={<RequirePermission permission="EXECUTE_TASK"><OutboundJobPage /></RequirePermission>} />
      <Route path="*" element={<Navigate to="/m/tasks" replace />} />
    </Routes>
  )
}

function AuthenticatedApp() {
  const meta = useQuery({ queryKey: ['meta'], queryFn: fetchMeta })

  return (
    <AppShell version={meta.data?.version}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/skus"
          element={
            <RequirePermission permission="MANAGE_MASTER">
              <MasterdataPage />
            </RequirePermission>
          }
        />
        <Route path="/locations" element={<Navigate to="/skus" replace />} />
        <Route path="/partners" element={<Navigate to="/skus" replace />} />
        <Route
          path="/inbound-orders"
          element={
            <RequirePermission permission="MANAGE_ORDER">
              <InboundOrderListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/inbound-orders/:id"
          element={
            <RequirePermission permission="MANAGE_ORDER">
              <InboundOrderDetailPage />
            </RequirePermission>
          }
        />
        <Route path="/outbound-orders" element={<RequirePermission permission="MANAGE_ORDER"><OutboundOrderListPage /></RequirePermission>} />
        <Route path="/outbound-orders/:id" element={<RequirePermission permission="MANAGE_ORDER"><OutboundOrderDetailPage /></RequirePermission>} />
        <Route path="/inventory" element={<RequirePermission permission="VIEW_INVENTORY"><InventoryPage mode="stock" /></RequirePermission>} />
        <Route path="/inventory/transactions" element={<RequirePermission permission="VIEW_INVENTORY"><InventoryPage mode="ledger" /></RequirePermission>} />
        <Route path="/operation-logs" element={<RequirePermission permission="VIEW_AUDIT"><OperationLogPage /></RequirePermission>} />
        <Route path="/users" element={<RequirePermission permission="MANAGE_USER"><UserListPage /></RequirePermission>} />
        <Route path="/stocktakes" element={<RequirePermission permission="MANAGE_ORDER"><StocktakeListPage /></RequirePermission>} />
        <Route path="/stocktakes/:id" element={<RequirePermission permission="MANAGE_ORDER"><StocktakeDetailPage /></RequirePermission>} />
        <Route path="/transfers" element={<RequirePermission permission="MANAGE_ORDER"><TransferPage /></RequirePermission>} />
        <Route path="/transfers/:id" element={<RequirePermission permission="MANAGE_ORDER"><TransferDetailRoute /></RequirePermission>} />
        {/* PRD: no dedicated 404 page. Unknown paths fall back to the dashboard. */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}


/** Loads a transfer order by id for the detail route. */
function TransferDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const q = useQuery({
    queryKey: ['transfer', orderId],
    queryFn: () => fetchTransfer(orderId),
    enabled: Number.isFinite(orderId),
  })
  if (q.isLoading) return <TableSkeleton cols={5} rows={4} />
  if (q.isError || !q.data) {
    return <EmptyState tone="error" icon="alert" title="Load failed" note={q.error instanceof Error ? q.error.message : ''} />
  }
  return <TransferDetailPage order={q.data} />
}
