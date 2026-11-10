import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import { fetchInboundOrders } from '../../shared/api/orders'
import { fetchOutboundOrders } from '../../shared/api/outbound'
import { EmptyState, Icon, TableSkeleton } from '../../shared/ui/Icon'

/** Light card list of pending documents — only the executing page is dark. */
export function MobileTaskListPage() {
  const { t } = useTranslation()
  const inbound = useQuery({ queryKey: ['mobile-tasks', 'in'], queryFn: () => fetchInboundOrders() })
  const outbound = useQuery({ queryKey: ['mobile-tasks', 'out'], queryFn: () => fetchOutboundOrders() })

  const inItems = (inbound.data?.items ?? []).filter((o) => o.status !== 'COMPLETED')
  const outItems = (outbound.data?.items ?? []).filter((o) => o.status !== 'COMPLETED')
  const loading = inbound.isLoading || outbound.isLoading
  const error = inbound.error ?? outbound.error

  return (
    <div className="mobile-task-list">
      <header className="mobile-list-head">
        <h1 className="page-title">{t('scan.tasks')}</h1>
        <Link to="/" className="text-link">
          <Icon name="arrow-left" size={14} />{t('scan.backConsole')}
        </Link>
      </header>

      {loading ? (
        <div className="task-cards"><TableSkeleton cols={2} rows={4} /></div>
      ) : error ? (
        <EmptyState
          tone="error"
          icon="alert"
          title={t('common.loadFailed')}
          note={error instanceof ApiError ? error.message : t('common.networkError')}
        />
      ) : inItems.length === 0 && outItems.length === 0 ? (
        <EmptyState title={t('common.empty')} note={t('scan.noTasks')} />
      ) : (
        <div className="task-cards">
          {inItems.map((order) => (
            <Link key={`in-${order.id}`} to={`/m/inbound/${order.id}`} className="task-card">
              <div className="task-card-head">
                <span className="cell-icon mono cell-code"><Icon name="inbound" size={15} />{order.orderNo}</span>
                <span className="status status-done">{t('nav.inbound')}</span>
              </div>
              <div className="task-card-meta">
                <span>{order.partnerName}</span>
                <span className="mono">{order.lines.filter((l) => l.status === 'DONE').length} / {order.lines.length} {t('scan.linesDone')}</span>
              </div>
              <div className="task-card-foot mono">
                {dayjs(order.createdAt).format('YYYY.MM.DD HH:mm')}
                <span><Icon name="arrow-right" size={13} />{t('scan.startJob')}</span>
              </div>
            </Link>
          ))}
          {outItems.map((order) => (
            <Link key={`out-${order.id}`} to={`/m/outbound/${order.id}`} className="task-card">
              <div className="task-card-head">
                <span className="cell-icon mono cell-code"><Icon name="outbound" size={15} />{order.orderNo}</span>
                <span className="status status-ongoing">{t('nav.outbound')}</span>
              </div>
              <div className="task-card-meta">
                <span>{order.partnerName}</span>
                <span className="mono">{order.lines.filter((l) => l.status === 'DONE').length} / {order.lines.length} {t('scan.linesDone')}</span>
              </div>
              <div className="task-card-foot mono">
                {dayjs(order.createdAt).format('YYYY.MM.DD HH:mm')}
                <span><Icon name="arrow-right" size={13} />{t('scan.startJob')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
