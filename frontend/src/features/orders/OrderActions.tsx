import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../shared/api/http'
import { fetchSkus, type Sku } from '../../shared/api/skus'
import { updateInboundOrder, deleteInboundOrder } from '../../shared/api/orders'
import { updateOutboundOrder, deleteOutboundOrder } from '../../shared/api/outbound'

export interface EditableLine {
  id: number
  skuId: number
  skuCode: string
  skuName: string
  expectedQty: number
}

export interface EditableOrder {
  id: number
  orderNo: string
  remark: string | null
  partnerId: number
  lines: EditableLine[]
}

/**
 * Edit / delete a DRAFT order. Shared by the inbound and outbound detail pages.
 * PARTIAL / COMPLETED orders never show these controls — they already produced
 * ledger rows and are immutable on the backend.
 */
export function OrderActions({
  kind,
  order,
  onChanged,
  onDeleted,
}: {
  kind: 'inbound' | 'outbound'
  order: EditableOrder
  onChanged: () => Promise<void>
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = useMutation({
    mutationFn: () => (kind === 'inbound' ? deleteInboundOrder(order.id) : deleteOutboundOrder(order.id)),
    onSuccess: onDeleted,
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <>
      <div className="detail-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
          {t('order.edit')}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
          {t('order.delete')}
        </button>
      </div>

      {error && <p className="field-error detail-action-error" role="alert">{error}</p>}

      {editing && (
        <EditOrderDrawer
          kind={kind}
          order={order}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false)
            await onChanged()
          }}
        />
      )}

      {confirming && (
        <div className="drawer-backdrop" onClick={() => setConfirming(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="drawer-title">{t('order.deleteConfirmTitle')}</h2>
            <p className="confirm-text">
              {t('order.deleteConfirmText')} <span className="mono">{order.orderNo}</span>
            </p>
            <div className="drawer-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={remove.isPending}
                onClick={() => { setError(null); remove.mutate() }}
              >
                {remove.isPending ? t('common.saving') : t('order.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function EditOrderDrawer({
  kind,
  order,
  onClose,
  onSaved,
}: {
  kind: 'inbound' | 'outbound'
  order: EditableOrder
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [remark, setRemark] = useState(order.remark ?? '')
  const [lines, setLines] = useState(
    order.lines.map((l) => ({ skuId: String(l.skuId), expectedQty: String(l.expectedQty) })),
  )
  const [error, setError] = useState<string | null>(null)

  const skus = useQuery({ queryKey: ['skus', ''], queryFn: () => fetchSkus() })
  const skuList: Sku[] = skus.data?.items ?? []

  const save = useMutation({
    mutationFn: () => {
      const input = {
        partnerId: order.partnerId,
        remark: remark || undefined,
        lines: lines.map((l) => ({ skuId: Number(l.skuId), expectedQty: Number(l.expectedQty) })),
      }
      return kind === 'inbound'
        ? updateInboundOrder(order.id, input)
        : updateOutboundOrder(order.id, input)
    },
    onSuccess: async () => { await onSaved() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="drawer-title">{t('order.edit')} · <span className="mono">{order.orderNo}</span></h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); setError(null); save.mutate() }}>
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
              {t('order.addLine')}
            </button>
          </div>

          {error && <p className="field-error" role="alert">{error}</p>}

          <div className="drawer-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
