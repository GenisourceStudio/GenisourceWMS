import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import {
  fetchStocktakes, fetchStocktake, createStocktake, confirmStocktakeLine, deleteStocktake,
  type StocktakeOrder,
} from '../../shared/api/stocktake'
import { fetchLocations, type Location } from '../../shared/api/locations'
import { Icon, TableSkeleton, EmptyState } from '../../shared/ui/Icon'
import { Select } from '../../shared/ui/Select'
import { Pagination } from '../../shared/ui/Pagination'

const PAGE_SIZE = 20

/** A 类: 盘点单. Create from a location's live stock, then count each line. */
export function StocktakeListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orders = useQuery({
    queryKey: ['stocktakes', status, page],
    queryFn: () => fetchStocktakes(status || undefined, page, PAGE_SIZE),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['stocktakes'] })

  const remove = useMutation({
    mutationFn: deleteStocktake,
    onSuccess: async () => { setError(null); await refresh() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.stocktakes')}</h1>
        <div className="page-actions">
          <div className="filter-select">
            <Select
              size="sm"
              value={status}
              onChange={(v) => { setStatus(v); setPage(0) }}
              placeholder={t('order.allStatus')}
              options={[
                { value: 'DRAFT', label: t('order.draft') },
                { value: 'PARTIAL', label: t('order.partial') },
                { value: 'COMPLETED', label: t('order.completed') },
              ]}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('stocktake.create')}
          </button>
        </div>
      </div>

      {error && <p className="field-error detail-action-error" role="alert">{error}</p>}

      <section className="panel panel-flush">
        {orders.isLoading ? (
          <TableSkeleton cols={5} rows={4} />
        ) : orders.isError ? (
          <EmptyState tone="error" icon="alert" title={t('common.loadFailed')}
            note={orders.error instanceof ApiError ? orders.error.message : t('common.networkError')} />
        ) : orders.data && orders.data.items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('order.colNo')}</th>
                <th scope="col">{t('order.colLocation')}</th>
                <th scope="col">{t('order.colStatus')}</th>
                <th scope="col">{t('stocktake.lines')}</th>
                <th scope="col">{t('order.colCreated')}</th>
                <th scope="col">{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.items.map((order) => (
                <tr key={order.id}>
                  <td className="mono cell-code"><Link to={`/stocktakes/${order.id}`}>{order.orderNo}</Link></td>
                  <td className="mono">{order.locationCode}</td>
                  <td>
                    <span className={order.status === 'COMPLETED' ? 'status status-done' : order.status === 'PARTIAL' ? 'status status-ongoing' : 'status status-draft'}>
                      {t(`order.${order.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="mono">{order.lines.filter((l) => l.status === 'DONE').length} / {order.lines.length}</td>
                  <td className="mono cell-muted">{dayjs(order.createdAt).format('YYYY.MM.DD HH:mm')}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="text-link" to={`/stocktakes/${order.id}`}>{t('stocktake.detail')}</Link>
                      {order.status === 'DRAFT' && (
                        <button type="button" className="text-link" onClick={() => remove.mutate(order.id)} disabled={remove.isPending}>
                          {t('order.delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title={t('common.empty')} note={t('stocktake.emptyNote')} />
        )}
      </section>

      {orders.data && <Pagination page={page} size={PAGE_SIZE} total={orders.data.total} onChange={setPage} />}

      {creating && (
        <CreateStocktakeDrawer onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await refresh() }} />
      )}
    </>
  )
}

function CreateStocktakeDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation()
  const [locationId, setLocationId] = useState('')
  const [remark, setRemark] = useState('')
  const [error, setError] = useState<string | null>(null)
  const locations = useQuery({ queryKey: ['locations', ''], queryFn: () => fetchLocations() })
  const locList: Location[] = locations.data?.items ?? []

  const mutation = useMutation({
    mutationFn: () => createStocktake(Number(locationId), remark || undefined),
    onSuccess: async () => { await onSaved() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="drawer-title">{t('stocktake.create')}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}>
          <label className="field">
            <span className="field-label">{t('order.colLocation')}</span>
            <Select
              value={locationId}
              onChange={setLocationId}
              placeholder={t('stocktake.selectLocation')}
              required
              mono
              options={locList.map((l) => ({ value: String(l.id), label: l.code }))}
            />
          </label>
          <p className="field-hint">{t('stocktake.snapshotHint')}</p>
          <label className="field">
            <span className="field-label">{t('order.remark')}</span>
            <input className="field-input" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="drawer-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

/** Detail: enter counted quantities and confirm each line. */
export function StocktakeDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const queryClient = useQueryClient()
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const order = useQuery({
    queryKey: ['stocktake', orderId],
    queryFn: () => fetchStocktake(orderId),
    enabled: Number.isFinite(orderId),
  })

  const confirm = useMutation({
    mutationFn: ({ lineId, actualQty }: { lineId: number; actualQty: number }) =>
      confirmStocktakeLine(orderId, lineId, actualQty),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['stocktake', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['stocktakes'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  if (order.isLoading) return <TableSkeleton cols={5} rows={5} />
  if (order.isError || !order.data) {
    return <EmptyState tone="error" icon="alert" title={t('common.loadFailed')}
      note={order.error instanceof ApiError ? order.error.message : t('common.networkError')} />
  }
  const data: StocktakeOrder = order.data
  const pending = data.lines.filter((l) => l.status === 'PENDING').length

  return (
    <>
      <div className="detail-head">
        <Link to="/stocktakes" className="text-link"><Icon name="arrow-left" size={14} /> {t('order.backToList')}</Link>
        <h1 className="page-title mono">{data.orderNo}</h1>
        <span className="status status-draft">{data.locationCode}</span>
        <span className={data.status === 'COMPLETED' ? 'status status-done' : data.status === 'PARTIAL' ? 'status status-ongoing' : 'status status-draft'}>
          {t(`order.${data.status.toLowerCase()}`)}
        </span>
      </div>

      {error && <p className="field-error detail-action-error" role="alert">{error}</p>}

      <section className="panel panel-flush">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('sku.colCode')}</th>
              <th scope="col">{t('sku.colName')}</th>
              <th scope="col" className="num">{t('stocktake.expected')}</th>
              <th scope="col">{t('stocktake.actual')}</th>
              <th scope="col">{t('sku.colStatus')}</th>
              <th scope="col">{t('users.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td className="mono cell-code">{line.skuCode}</td>
                <td>{line.skuName}</td>
                <td className="num mono">{line.expectedQty}</td>
                <td>
                  {line.status === 'DONE' ? (
                    <span className="mono">{line.actualQty}</span>
                  ) : (
                    <input
                      className="field-input field-input-sm num"
                      type="number"
                      min="0"
                      value={counts[line.id] ?? String(line.expectedQty)}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [line.id]: e.target.value }))}
                      aria-label={t('stocktake.actual')}
                    />
                  )}
                </td>
                <td>
                  <span className={line.status === 'DONE' ? 'status status-done' : 'status status-draft'}>
                    {line.status === 'DONE' ? t('order.lineDone') : t('order.linePending')}
                  </span>
                </td>
                <td>
                  {line.status === 'PENDING' && (
                    <button type="button" className="text-link"
                      onClick={() => confirm.mutate({
                        lineId: line.id,
                        actualQty: Number(counts[line.id] ?? line.expectedQty),
                      })}
                      disabled={confirm.isPending}>
                      {t('stocktake.confirmLine')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pending === 0 && <p className="stocktake-done"><Icon name="check" size={16} /> {t('stocktake.allDone')}</p>}
    </>
  )
}
