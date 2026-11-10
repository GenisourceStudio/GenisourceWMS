import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import { fetchOperationLogs, type LogQuery } from '../../shared/api/logs'
import { Icon, TableSkeleton, EmptyState } from '../../shared/ui/Icon'
import { Pagination } from '../../shared/ui/Pagination'

const PAGE_SIZE = 20

export function OperationLogPage() {
  const { t } = useTranslation()
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState<LogQuery>({})
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<number | null>(null)

  const logs = useQuery({
    queryKey: ['operation-logs', query, page],
    queryFn: () => fetchOperationLogs({ ...query, page, size: PAGE_SIZE }),
  })

  function apply() {
    setPage(0)
    setQuery({
      action: action || undefined,
      actor: actor.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
    })
  }

  function reset() {
    setPage(0)
    setAction(''); setActor(''); setFrom(''); setTo(''); setQuery({})
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.logs')}</h1>
      </div>

      <div className="filter-bar">
        <select className="field-input field-input-sm" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{t('logs.allActions')}</option>
          <option value="STOCK_INBOUND">{t('inventory.inbound')}</option>
          <option value="STOCK_OUTBOUND">{t('inventory.outbound')}</option>
        </select>
        <input
          className="field-input field-input-sm"
          placeholder={t('logs.actor')}
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
        />
        <input className="field-input field-input-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('inventory.from')} />
        <input className="field-input field-input-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('inventory.to')} />
        <button type="button" className="btn btn-secondary" onClick={apply}>
          <Icon name="search" size={15} /> {t('sku.search')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={reset}>
          <Icon name="refresh" size={15} /> {t('inventory.reset')}
        </button>
      </div>

      <section className="panel panel-flush">
        {logs.isLoading ? (
          <TableSkeleton cols={5} rows={6} />
        ) : logs.isError ? (
          <EmptyState
            tone="error"
            icon="alert"
            title={t('common.loadFailed')}
            note={logs.error instanceof ApiError ? logs.error.message : t('common.networkError')}
          />
        ) : logs.data && logs.data.items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('inventory.time')}</th>
                <th scope="col">{t('logs.action')}</th>
                <th scope="col">{t('inventory.operator')}</th>
                <th scope="col">{t('logs.target')}</th>
                <th scope="col">{t('logs.detail')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.items.map((log) => {
                let detail: Record<string, unknown> = {}
                try { detail = log.detailJson ? JSON.parse(log.detailJson) : {} } catch { /* keep empty */ }
                const isOpen = expanded === log.id
                return (
                  <tr key={log.id} className={isOpen ? 'row-open' : ''}>
                    <td className="mono cell-muted">{dayjs(log.occurredAt).format('MM.DD HH:mm:ss')}</td>
                    <td><span className="status status-draft">{log.action}</span></td>
                    <td>{log.actorName}</td>
                    <td className="mono cell-muted">{log.targetType ?? '—'} #{log.targetId ?? '—'}</td>
                    <td>
                      <button type="button" className="text-link" onClick={() => setExpanded(isOpen ? null : log.id)}>
                        <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={14} />
                        {isOpen ? t('logs.collapse') : t('logs.expand')}
                      </button>
                      {isOpen && (
                        <pre className="log-detail mono rise">{JSON.stringify(detail, null, 2)}</pre>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title={t('common.empty')} note={t('logs.emptyNote')} />
        )}
      </section>

      {logs.data && (
        <Pagination page={page} size={PAGE_SIZE} total={logs.data.total} onChange={setPage} />
      )}
    </>
  )
}
