import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { fetchDashboardSummary, fetchHealth, fetchMeta } from '../shared/api/endpoints'
import { fetchInboundOrders } from '../shared/api/orders'
import { fetchOutboundOrders } from '../shared/api/outbound'
import { fetchInventory } from '../shared/api/inventory'
import { HeroRipple } from '../shared/ui/BrandMark'
import { Icon, TableSkeleton, type IconName } from '../shared/ui/Icon'

const KPI_ICONS: IconName[] = ['file', 'inbound', 'outbound', 'layers']

/**
 * Landing page. Every number comes from a real backend query: the four Hero
 * KPIs from /dashboard/summary, the status panel from /meta and /actuator/health.
 */
export function DashboardPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const meta = useQuery({ queryKey: ['meta'], queryFn: fetchMeta })
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 30_000 })
  const summary = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchDashboardSummary })
  const inbound = useQuery({ queryKey: ['dashboard-inbound'], queryFn: () => fetchInboundOrders(undefined, 0, 5) })
  const outbound = useQuery({ queryKey: ['dashboard-outbound'], queryFn: () => fetchOutboundOrders(undefined, 0, 5) })
  const lowStock = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: () => fetchInventory({ lowStockOnly: true, threshold: 5, size: 5 }),
  })

  const pending = [
    ...(inbound.data?.items ?? [])
      .filter((o) => o.status !== 'COMPLETED')
      .map((o) => ({ id: o.id, no: o.orderNo, partner: o.partnerName, status: o.status, createdAt: o.createdAt, kind: 'in' as const })),
    ...(outbound.data?.items ?? [])
      .filter((o) => o.status !== 'COMPLETED')
      .map((o) => ({ id: o.id, no: o.orderNo, partner: o.partnerName, status: o.status, createdAt: o.createdAt, kind: 'out' as const })),
  ].slice(0, 5)
  const lowItems = lowStock.data?.items ?? []

  const online = health.isSuccess && health.data?.status === 'UP'
  const loading = meta.isLoading || health.isLoading
  const refreshing = meta.isFetching || health.isFetching || summary.isFetching

  const kpis = [
    { label: t('dashboard.kpiPendingOrders'), value: summary.data?.pendingOrders },
    { label: t('dashboard.kpiTodayInbound'), value: summary.data?.todayInbound },
    { label: t('dashboard.kpiTodayOutbound'), value: summary.data?.todayOutbound },
    { label: t('dashboard.kpiStockTotal'), value: summary.data?.stockTotal },
  ]

  return (
    <>
      <section className="hero rise">
        <span className="hero-kicker">{t('dashboard.kicker')}</span>
        <h1 className="hero-title">{t('dashboard.title')}</h1>
        <p className="hero-lead">{t('dashboard.lead')}</p>

        <div className="hero-kpis">
          {kpis.map((kpi, index) => (
            <div className="kpi" key={kpi.label}>
              <div className="kpi-value">{kpi.value ?? '—'}</div>
              <div className="kpi-label">
                <Icon name={KPI_ICONS[index]} size={13} />
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        <HeroRipple />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">
            <span className="panel-index">01</span>
            {t('dashboard.systemPanel')}
          </h2>
          <div className="panel-actions">
            <span className="panel-note">{t('dashboard.systemPanelNote')}</span>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => void queryClient.invalidateQueries()}
              disabled={refreshing}
              aria-label={t('common.refresh')}
              title={t('common.refresh')}
            >
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <TableSkeleton cols={2} rows={2} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('dashboard.colStatus')}</th>
                <th scope="col">{t('dashboard.colValue')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="cell-icon">
                    <Icon name="database" size={15} />
                    {t('dashboard.backendVersion')}
                  </span>
                </td>
                <td className="mono">{meta.data?.version ?? '—'}</td>
              </tr>
              <tr>
                <td>
                  <span className="cell-icon">
                    <Icon name="activity" size={15} />
                    {t('dashboard.database')}
                  </span>
                </td>
                <td>
                  {online ? (
                    <span className="status status-ongoing">{health.data?.status}</span>
                  ) : (
                    <span className="status status-error">{t('dashboard.unavailable')}</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section className="panel panel-flush">
        <div className="panel-head panel-head-padded">
          <h2 className="panel-title">
            <span className="panel-index">02</span>
            {t('dashboard.pendingPanel')}
          </h2>
          <Link to="/inbound-orders" className="text-link">{t('dashboard.viewAll')}</Link>
        </div>
        {pending.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('order.colNo')}</th>
                <th scope="col">{t('order.colPartner')}</th>
                <th scope="col">{t('order.colStatus')}</th>
                <th scope="col">{t('order.colCreated')}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((o) => (
                <tr key={`${o.kind}-${o.id}`}>
                  <td className="mono cell-code">
                    <Link to={o.kind === 'in' ? `/inbound-orders/${o.id}` : `/outbound-orders/${o.id}`}>{o.no}</Link>
                  </td>
                  <td>{o.partner}</td>
                  <td><span className="status status-ongoing">{t(`order.${o.status.toLowerCase()}`)}</span></td>
                  <td className="mono cell-muted">{dayjs(o.createdAt).format('YYYY.MM.DD HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <div className="empty-title">{t('common.empty')}</div>
            <div className="empty-note">{t('dashboard.noPending')}</div>
          </div>
        )}
      </section>

      <section className="panel panel-flush">
        <div className="panel-head panel-head-padded">
          <h2 className="panel-title">
            <span className="panel-index">03</span>
            {t('dashboard.lowStockPanel')}
          </h2>
          <span className="panel-note">{t('dashboard.lowStockNote', { threshold: 5 })}</span>
        </div>
        {lowItems.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('sku.colCode')}</th>
                <th scope="col">{t('order.colLocation')}</th>
                <th scope="col" className="num">{t('inventory.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {lowItems.map((i) => (
                <tr key={`${i.skuId}-${i.locationId}`}>
                  <td className="mono cell-code">{i.skuCode}</td>
                  <td className="mono">{i.locationCode}</td>
                  <td className="num mono qty-low">{i.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <div className="empty-title">{t('dashboard.noLowStock')}</div>
            <div className="empty-note">{t('dashboard.noLowStockNote')}</div>
          </div>
        )}
      </section>
    </>
  )
}
