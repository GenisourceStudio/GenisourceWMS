import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import { fetchOperationLogs } from '../../shared/api/logs'

export function OperationLogPage() {
  const { t } = useTranslation()
  const [action, setAction] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const logs = useQuery({
    queryKey: ['operation-logs', action],
    queryFn: () => fetchOperationLogs(action || undefined),
  })

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.logs')}</h1>
        <div className="page-actions">
          <select className="field-input field-input-sm" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t('logs.allActions')}</option>
            <option value="STOCK_INBOUND">{t('inventory.inbound')}</option>
            <option value="STOCK_OUTBOUND">{t('inventory.outbound')}</option>
          </select>
        </div>
      </div>

      <section className="panel panel-flush">
        {logs.isLoading ? (
          <div className="empty"><div className="empty-note">{t('common.loading')}</div></div>
        ) : logs.isError ? (
          <div className="empty">
            <div className="empty-title">{t('common.loadFailed')}</div>
            <div className="empty-note">{logs.error instanceof ApiError ? logs.error.message : t('common.networkError')}</div>
          </div>
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
                        {isOpen ? t('logs.collapse') : t('logs.expand')}
                      </button>
                      {isOpen && (
                        <pre className="log-detail mono">{JSON.stringify(detail, null, 2)}</pre>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <div className="empty-title">{t('common.empty')}</div>
            <div className="empty-note">{t('logs.emptyNote')}</div>
          </div>
        )}
      </section>
    </>
  )
}
