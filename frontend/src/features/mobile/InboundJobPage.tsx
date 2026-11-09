import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../shared/api/http'
import { fetchInboundTask, confirmInboundLine } from '../../shared/api/scan'

/**
 * Mobile inbound job — the "工位终端" pattern from design-system.md §6.
 * Full-screen navy, lifted scan box, 2x2 large buttons, inline errors.
 * Manual code entry is an equal fallback path, not a degraded one.
 */
export function InboundJobPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const queryClient = useQueryClient()

  const task = useQuery({
    queryKey: ['inbound-task', orderId],
    queryFn: () => fetchInboundTask(orderId),
    enabled: Number.isFinite(orderId),
  })

  const [sku, setSku] = useState('')
  const [location, setLocation] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [tokens, setTokens] = useState<Record<number, string>>({})
  const skuRef = useRef<HTMLInputElement>(null)

  const lines = task.data?.lines ?? []
  const doneCount = lines.filter((l) => l.status === 'DONE').length
  const pending = lines.filter((l) => l.status === 'PENDING')
  const current = pending[0] ?? null

  // When the current row changes (after a successful confirm), prefill its
  // expected quantity and put the cursor back in the SKU field.
  useEffect(() => {
    if (current) {
      setQty(String(current.expectedQty))
      setSku('')
      setLocation('')
      setError(null)
      skuRef.current?.focus()
    }
  }, [current?.id])

  // A stable idempotency key per row. Generated when the row becomes active,
  // never during render (which would cause a state update inside render).
  useEffect(() => {
    if (current) {
      setTokens((prev) => prev[current.id] ? prev : { ...prev, [current.id]: crypto.randomUUID() })
    }
  }, [current?.id])

  async function handleConfirm() {
    if (!current) return
    setError(null)
    setSubmitting(true)
    try {
      await confirmInboundLine(orderId, current.id, {
        skuCode: sku.trim(),
        locationCode: location.trim(),
        qty: Number(qty),
        clientToken: tokens[current.id] ?? crypto.randomUUID(),
      })
      setTokens((prev) => {
        const next = { ...prev }
        delete next[current.id]
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['inbound-task', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['inbound-orders'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (task.isLoading) {
    return <div className="mobile"><div className="mobile-top">{t('common.loading')}</div></div>
  }
  if (task.isError || !task.data) {
    return (
      <div className="mobile">
        <div className="mobile-top">
          <Link to="/m/tasks" className="text-link">← {t('order.backToList')}</Link>
          <span>{t('common.loadFailed')}</span>
        </div>
        <div className="mobile-body">
          <p className="field-error" role="alert">
            {task.error instanceof ApiError ? task.error.message : t('common.networkError')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile">
      <div className="mobile-top">
        <Link to="/m/tasks" className="text-link">← {t('scan.tasks')}</Link>
        <span className="mono">{task.data.orderNo}</span>
      </div>

      <div className="mobile-progress">
        <span className="mono">{t('scan.line')} {doneCount + 1} / {lines.length}</span>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${(doneCount / lines.length) * 100}%` }} /></div>
      </div>

      {current ? (
        <div className="mobile-body">
          <div className="scan-target">
            <div className="scan-target-code mono">{current.skuCode}</div>
            <div className="scan-target-name">{current.skuName}</div>
            <div className="scan-target-qty mono">{t('scan.expected')} {current.expectedQty}</div>
          </div>

          <input
            ref={skuRef}
            className="scan-box scan-field"
            placeholder={t('scan.scanSku')}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            aria-label={t('scan.scanSku')}
          />
          <input
            className="scan-box scan-field"
            placeholder={t('scan.scanLocation')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            aria-label={t('scan.scanLocation')}
          />
          <input
            className="scan-box scan-field num"
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label={t('scan.qty')}
          />

          {error && <p className="scan-error" role="alert">{error}</p>}

          <div className="scan-actions">
            <button type="button" className="scan-btn" onClick={() => skuRef.current?.focus()}>
              {t('scan.manual')}
            </button>
            <button type="button" className="scan-btn" onClick={() => { setSku(''); setLocation(''); setError(null); skuRef.current?.focus() }}>
              {t('scan.rescan')}
            </button>
            <button type="button" className="scan-btn scan-btn-primary" onClick={handleConfirm} disabled={submitting}>
              {submitting ? t('common.saving') : t('scan.confirmLine')}
            </button>
            <Link to="/m/tasks" className="scan-btn scan-btn-link">{t('common.cancel')}</Link>
          </div>
        </div>
      ) : (
        <div className="mobile-body mobile-done">
          <div className="scan-done-mark">✓</div>
          <div className="scan-done-title">{t('scan.allDone')}</div>
          <div className="mono">{doneCount} / {lines.length} {t('scan.linesDone')}</div>
          <Link to="/m/tasks" className="btn btn-primary">{t('scan.backToTasks')}</Link>
        </div>
      )}
    </div>
  )
}
