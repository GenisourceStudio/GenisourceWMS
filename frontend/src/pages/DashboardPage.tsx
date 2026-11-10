import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchDashboardSummary, fetchHealth, fetchMeta } from '../shared/api/endpoints'
import { HeroRipple } from '../shared/ui/BrandMark'

/**
 * Landing page. Every number comes from a real backend query: the four Hero
 * KPIs from /dashboard/summary, the status panel from /meta and /actuator/health.
 */
export function DashboardPage() {
  const { t } = useTranslation()

  const meta = useQuery({ queryKey: ['meta'], queryFn: fetchMeta })
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 30_000 })
  const summary = useQuery({ queryKey: ['dashboard-summary'], queryFn: fetchDashboardSummary })

  const online = health.isSuccess && health.data?.status === 'UP'
  const loading = meta.isLoading || health.isLoading

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
          {kpis.map((kpi) => (
            <div className="kpi" key={kpi.label}>
              <div className="kpi-value">{kpi.value ?? '—'}</div>
              <div className="kpi-label">{kpi.label}</div>
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
          <span className="panel-note">{t('dashboard.systemPanelNote')}</span>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('dashboard.colStatus')}</th>
              <th scope="col">{t('dashboard.colValue')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('dashboard.backendVersion')}</td>
              <td className="mono">{loading ? t('dashboard.loading') : (meta.data?.version ?? '—')}</td>
            </tr>
            <tr>
              <td>{t('dashboard.database')}</td>
              <td>
                {loading ? (
                  <span className="status status-draft">{t('dashboard.loading')}</span>
                ) : online ? (
                  <span className="status status-ongoing">{health.data?.status}</span>
                ) : (
                  <span className="status status-error">{t('dashboard.unavailable')}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  )
}
