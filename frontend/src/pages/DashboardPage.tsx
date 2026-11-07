import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchHealth, fetchMeta } from '../shared/api/endpoints'
import { HeroRipple } from '../shared/ui/BrandMark'

/**
 * Scaffold landing page. Every number here comes from the backend — the point
 * of the first slice is to prove the SPA, the API and PostgreSQL are wired up
 * end to end (docs/SYSTEM_DESIGN.md §11.1 step 1).
 */
export function DashboardPage() {
  const { t } = useTranslation()

  const meta = useQuery({ queryKey: ['meta'], queryFn: fetchMeta })
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 30_000 })

  const online = health.isSuccess && health.data?.status === 'UP'
  const loading = meta.isLoading || health.isLoading

  return (
    <>
      <section className="hero rise">
        <span className="hero-kicker">{t('dashboard.kicker')}</span>
        <h1 className="hero-title">{t('dashboard.title')}</h1>
        <p className="hero-lead">{t('dashboard.lead')}</p>

        <div className="hero-kpis">
          <div className="kpi">
            <div className="kpi-value">—</div>
            <div className="kpi-label">{t('dashboard.kpiPendingOrders')}</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">—</div>
            <div className="kpi-label">{t('dashboard.kpiTodayInbound')}</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">—</div>
            <div className="kpi-label">{t('dashboard.kpiTodayOutbound')}</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">—</div>
            <div className="kpi-label">{t('dashboard.kpiStockTotal')}</div>
          </div>
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
