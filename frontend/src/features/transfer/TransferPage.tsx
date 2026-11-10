import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import {
  fetchTransfers, createTransfer, confirmTransferLine, deleteTransfer,
  type TransferOrder,
} from '../../shared/api/transfer'
import { fetchSkus, type Sku } from '../../shared/api/skus'
import { fetchLocations, type Location } from '../../shared/api/locations'
import { TableSkeleton, EmptyState } from '../../shared/ui/Icon'
import { Pagination } from '../../shared/ui/Pagination'

const PAGE_SIZE = 20

/** A 类: 库位间调拨. Lists, creates drafts and confirms lines. */
export function TransferPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orders = useQuery({
    queryKey: ['transfers', status, page],
    queryFn: () => fetchTransfers(status || undefined, page, PAGE_SIZE),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['transfers'] })

  const confirm = useMutation({
    mutationFn: ({ orderId, lineId }: { orderId: number; lineId: number }) =>
      confirmTransferLine(orderId, lineId, crypto.randomUUID()),
    onSuccess: async () => { setError(null); await refresh() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  const remove = useMutation({
    mutationFn: deleteTransfer,
    onSuccess: async () => { setError(null); await refresh() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.transfers')}</h1>
        <div className="page-actions">
          <select className="field-input field-input-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
            <option value="">{t('order.allStatus')}</option>
            <option value="DRAFT">{t('order.draft')}</option>
            <option value="PARTIAL">{t('order.partial')}</option>
            <option value="COMPLETED">{t('order.completed')}</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('transfer.create')}
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
                <th scope="col">{t('order.colStatus')}</th>
                <th scope="col">{t('transfer.lines')}</th>
                <th scope="col">{t('order.colCreated')}</th>
                <th scope="col">{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.items.map((order) => {
                const pending = order.lines.find((l) => l.status === 'PENDING')
                return (
                  <tr key={order.id}>
                    <td className="mono cell-code">{order.orderNo}</td>
                    <td>
                      <span className={order.status === 'COMPLETED' ? 'status status-done' : order.status === 'PARTIAL' ? 'status status-ongoing' : 'status status-draft'}>
                        {t(`order.${order.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="mono">{order.lines.filter((l) => l.status === 'DONE').length} / {order.lines.length}</td>
                    <td className="mono cell-muted">{dayjs(order.createdAt).format('YYYY.MM.DD HH:mm')}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="text-link" to={`/transfers/${order.id}`}>{t('transfer.detail')}</Link>
                        {pending && (
                          <button type="button" className="text-link"
                            onClick={() => confirm.mutate({ orderId: order.id, lineId: pending.id })}
                            disabled={confirm.isPending}>
                            {t('transfer.confirm')}
                          </button>
                        )}
                        {order.status === 'DRAFT' && (
                          <button type="button" className="text-link"
                            onClick={() => remove.mutate(order.id)} disabled={remove.isPending}>
                            {t('order.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title={t('common.empty')} note={t('transfer.emptyNote')} />
        )}
      </section>

      {orders.data && <Pagination page={page} size={PAGE_SIZE} total={orders.data.total} onChange={setPage} />}

      {creating && (
        <CreateTransferDrawer
          onClose={() => setCreating(false)}
          onSaved={async () => { setCreating(false); await refresh() }}
        />
      )}
    </>
  )
}

function CreateTransferDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation()
  const [remark, setRemark] = useState('')
  const [lines, setLines] = useState([{ skuId: '', fromLocationId: '', toLocationId: '', qty: '1' }])
  const [error, setError] = useState<string | null>(null)

  const skus = useQuery({ queryKey: ['skus', ''], queryFn: () => fetchSkus() })
  const locations = useQuery({ queryKey: ['locations', ''], queryFn: () => fetchLocations() })
  const skuList: Sku[] = skus.data?.items ?? []
  const locList: Location[] = locations.data?.items ?? []

  const mutation = useMutation({
    mutationFn: () => createTransfer({
      remark: remark || undefined,
      lines: lines.map((l) => ({
        skuId: Number(l.skuId),
        fromLocationId: Number(l.fromLocationId),
        toLocationId: Number(l.toLocationId),
        qty: Number(l.qty),
      })),
    }),
    onSuccess: async () => { await onSaved() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  const update = (index: number, field: string, value: string) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="drawer-title">{t('transfer.create')}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}>
          <label className="field">
            <span className="field-label">{t('order.remark')}</span>
            <input className="field-input" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </label>

          <div className="form-section">
            <span className="field-label">{t('transfer.lines')}</span>
            {lines.map((line, index) => (
              <div className="transfer-line-row" key={index}>
                <select className="field-input" value={line.skuId} onChange={(e) => update(index, 'skuId', e.target.value)} required>
                  <option value="">{t('order.selectSku')}</option>
                  {skuList.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select>
                <select className="field-input" value={line.fromLocationId} onChange={(e) => update(index, 'fromLocationId', e.target.value)} required>
                  <option value="">{t('transfer.from')}</option>
                  {locList.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                </select>
                <select className="field-input" value={line.toLocationId} onChange={(e) => update(index, 'toLocationId', e.target.value)} required>
                  <option value="">{t('transfer.to')}</option>
                  {locList.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                </select>
                <input className="field-input num" type="number" min="1" value={line.qty}
                  onChange={(e) => update(index, 'qty', e.target.value)} required />
                {lines.length > 1 && (
                  <button type="button" className="btn btn-secondary btn-icon"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>×</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary"
              onClick={() => setLines((prev) => [...prev, { skuId: '', fromLocationId: '', toLocationId: '', qty: '1' }])}>
              {t('order.addLine')}
            </button>
          </div>

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

/** Detail view for a single transfer order. */
export function TransferDetailPage({ order }: { order: TransferOrder }) {
  const { t } = useTranslation()
  return (
    <section className="panel panel-flush">
      <div className="panel-head panel-head-padded">
        <h2 className="panel-title"><span className="panel-index">—</span><span className="mono">{order.orderNo}</span></h2>
        <span className="status status-draft">{t(`order.${order.status.toLowerCase()}`)}</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t('sku.colCode')}</th>
            <th scope="col">{t('transfer.from')}</th>
            <th scope="col">{t('transfer.to')}</th>
            <th scope="col" className="num">{t('inventory.qty')}</th>
            <th scope="col">{t('sku.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id}>
              <td className="mono cell-code">{l.skuCode}</td>
              <td className="mono">{l.fromLocationCode}</td>
              <td className="mono">{l.toLocationCode}</td>
              <td className="num mono">{l.qty}</td>
              <td><span className={l.status === 'DONE' ? 'status status-done' : 'status status-draft'}>{l.status === 'DONE' ? t('order.lineDone') : t('order.linePending')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
