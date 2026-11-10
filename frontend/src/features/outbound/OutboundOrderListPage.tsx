import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import { fetchOutboundOrders, createOutboundOrder, type OrderStatus } from '../../shared/api/outbound'
import { fetchPartners, type Partner } from '../../shared/api/partners'
import { fetchSkus, type Sku } from '../../shared/api/skus'
import { Icon, TableSkeleton, EmptyState, ButtonDots, useEscapeKey } from '../../shared/ui/Icon'
import { Pagination } from '../../shared/ui/Pagination'

const STATUS_CLASS: Record<OrderStatus, string> = {
  DRAFT: 'status-draft',
  PARTIAL: 'status-ongoing',
  COMPLETED: 'status-done',
}

const PAGE_SIZE = 20

export function OutboundOrderListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(0)

  const orders = useQuery({
    queryKey: ['outbound-orders', status, page],
    queryFn: () => fetchOutboundOrders(status || undefined, page, PAGE_SIZE),
  })

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.outbound')}</h1>
        <div className="page-actions">
          <select className="field-input field-input-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('order.allStatus')}</option>
            <option value="DRAFT">{t('order.draft')}</option>
            <option value="PARTIAL">{t('order.partial')}</option>
            <option value="COMPLETED">{t('order.completed')}</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={15} /> {t('order.createOutbound')}
          </button>
        </div>
      </div>

      <section className="panel panel-flush">
        {orders.isLoading ? (
          <TableSkeleton cols={5} rows={6} />
        ) : orders.isError ? (
          <EmptyState
            tone="error"
            icon="alert"
            title={t('common.loadFailed')}
            note={orders.error instanceof ApiError ? orders.error.message : t('common.networkError')}
          />
        ) : orders.data && orders.data.items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('order.colNo')}</th>
                <th scope="col">{t('order.colPartner')}</th>
                <th scope="col">{t('order.colStatus')}</th>
                <th scope="col">{t('order.colProgress')}</th>
                <th scope="col">{t('order.colCreated')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.items.map((order) => {
                const done = order.lines.filter((l) => l.status === 'DONE').length
                return (
                  <tr key={order.id}>
                    <td className="mono cell-code">
                      <Link to={`/outbound-orders/${order.id}`}>{order.orderNo}</Link>
                    </td>
                    <td>{order.partnerName}</td>
                    <td><span className={`status ${STATUS_CLASS[order.status]}`}>{t(`order.${order.status.toLowerCase()}`)}</span></td>
                    <td className="mono">
                      <div className="progress-wrap">
                        <span>{done} / {order.lines.length}</span>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${order.lines.length ? (done / order.lines.length) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="mono cell-muted">{dayjs(order.createdAt).format('YYYY.MM.DD HH:mm')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title={t('common.empty')} note={t('order.outboundEmptyNote')} />
        )}
      </section>

      {orders.data && (
        <Pagination page={page} size={PAGE_SIZE} total={orders.data.total} onChange={setPage} />
      )}

      {creating && (
        <CreateOutboundDrawer
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false)
            await queryClient.invalidateQueries({ queryKey: ['outbound-orders'] })
          }}
        />
      )}
    </>
  )
}

function CreateOutboundDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation()
  useEscapeKey(onClose)
  const [partnerId, setPartnerId] = useState('')
  const [remark, setRemark] = useState('')
  const [lines, setLines] = useState<{ skuId: string; expectedQty: string }[]>([{ skuId: '', expectedQty: '1' }])
  const [error, setError] = useState<string | null>(null)

  const partners = useQuery({ queryKey: ['partners', 'CUSTOMER'], queryFn: () => fetchPartners('CUSTOMER') })
  const skus = useQuery({ queryKey: ['skus', ''], queryFn: () => fetchSkus() })
  const customers: Partner[] = partners.data?.items ?? []
  const skuList: Sku[] = skus.data?.items ?? []

  const mutation = useMutation({
    mutationFn: () => createOutboundOrder({
      partnerId: Number(partnerId),
      remark: remark || undefined,
      lines: lines.map((l) => ({ skuId: Number(l.skuId), expectedQty: Number(l.expectedQty) })),
    }),
    onSuccess: async () => { await onSaved() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="drawer-title">{t('order.createOutbound')}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}><Icon name="close" size={18} /></button>
        </div>
        <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}>
          <label className="field">
            <span className="field-label">{t('order.customer')}</span>
            <select className="field-input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
              <option value="">{t('order.selectCustomer')}</option>
              {customers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('order.remark')}</span>
            <input className="field-input" value={remark} onChange={(e) => setRemark(e.target.value)} />
          </label>
          <div className="form-section">
            <span className="field-label">{t('order.lines')}</span>
            {lines.map((line, index) => (
              <div className="order-line-row" key={index}>
                <select
                  className="field-input"
                  value={line.skuId}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, skuId: e.target.value } : l)))}
                  required
                >
                  <option value="">{t('order.selectSku')}</option>
                  {skuList.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
                </select>
                <input
                  className="field-input num"
                  type="number"
                  min="1"
                  value={line.expectedQty}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, expectedQty: e.target.value } : l)))}
                  required
                />
                {lines.length > 1 && (
                  <button type="button" className="btn btn-secondary btn-icon" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>×</button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => setLines((prev) => [...prev, { skuId: '', expectedQty: '1' }])}>
              <Icon name="plus" size={14} /> {t('order.addLine')}
            </button>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="drawer-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? <><ButtonDots />{t('common.saving')}</> : t('common.save')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
