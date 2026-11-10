import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../shared/api/http'
import { fetchInboundTask, confirmInboundLine } from '../../shared/api/scan'
import { ButtonDots, Icon } from '../../shared/ui/Icon'
import { haptic } from '../../shared/ui/haptics'
import { BarcodeScanner, type ScanTarget } from '../../shared/ui/BarcodeScanner'

/** Enter walks the operator down the field chain: SKU → location → qty → confirm. */
function focusNext(event: React.KeyboardEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement | null>) {
  if (event.key === 'Enter') {
    event.preventDefault()
    ref.current?.focus()
  }
}

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
  const [batchNo, setBatchNo] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tokens, setTokens] = useState<Record<number, string>>({})
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null)
  const skuRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const lines = task.data?.lines ?? []
  const doneCount = lines.filter((l) => l.status === 'DONE').length
  const pending = lines.filter((l) => l.status === 'PENDING')
  const current = pending[0] ?? null
  // When the order is fully done there is no "current" row, so the counter
  // must not show doneCount + 1 (it used to render "3 / 2").
  const progressLine = current ? doneCount + 1 : doneCount
  const progressPct = lines.length ? (doneCount / lines.length) * 100 : 0

  const skuTyped = sku.trim()
  const skuMatch = current ? skuTyped.length > 0 && skuTyped === current.skuCode : false
  // Only call a mismatch once the typed value is as long as the expected code,
  // so manual typing does not flash an error on every keystroke.
  const skuMismatch = current ? skuTyped.length >= current.skuCode.length && !skuMatch : false

  // When the current row changes (after a successful confirm), prefill its
  // expected quantity and put the cursor back in the SKU field.
  useEffect(() => {
    if (current) {
      setQty(String(current.expectedQty))
      setBatchNo('')
      setExpiryDate('')
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
    if (!current || submitting) return
    setError(null)
    setNeedsRefresh(false)
    setSubmitting(true)
    try {
      await confirmInboundLine(orderId, current.id, {
        skuCode: sku.trim(),
        locationCode: location.trim(),
        qty: Number(qty),
        clientToken: tokens[current.id] ?? crypto.randomUUID(),
        batchNo: batchNo.trim() || undefined,
        expiryDate: expiryDate || undefined,
      })
      haptic([30, 40, 30])
      setTokens((prev) => {
        const next = { ...prev }
        delete next[current.id]
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['inbound-task', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['inbound-orders'] })
    } catch (err) {
      haptic(80)
      setError(err instanceof ApiError ? err.message : t('common.networkError'))
      // A stale pick hint / changed stock can be recovered by refreshing the
      // task instead of leaving the operator stuck on the same error.
      if (err instanceof ApiError &&
          ['LOCATION_INVALID', 'INSUFFICIENT_STOCK', 'ORDER_COMPLETED'].includes(err.code ?? '')) {
        setNeedsRefresh(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (task.isLoading) {
    return (
      <div className="mobile">
        <div className="mobile-top">
          <Link to="/m/tasks" className="text-link"><Icon name="arrow-left" size={14} />{t('scan.tasks')}</Link>
        </div>
        <div className="mobile-body mobile-done">
          <span className="scan-wait">
            {t('common.loading')}
            <span className="scan-caret" aria-hidden="true" />
          </span>
        </div>
      </div>
    )
  }
  if (task.isError || !task.data) {
    return (
      <div className="mobile">
        <div className="mobile-top">
          <Link to="/m/tasks" className="text-link"><Icon name="arrow-left" size={14} />{t('scan.tasks')}</Link>
          <span>{t('common.loadFailed')}</span>
        </div>
        <div className="mobile-body">
          <p className="scan-error" role="alert">
            <Icon name="alert" size={16} />
            {task.error instanceof ApiError ? task.error.message : t('common.networkError')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile">
      <div className="mobile-top">
        <Link to="/m/tasks" className="text-link"><Icon name="arrow-left" size={14} />{t('scan.tasks')}</Link>
        <span className="mono">{task.data.orderNo}</span>
      </div>

      <div className="mobile-progress">
        <span className="mono">{t('scan.line')} {progressLine} / {lines.length}</span>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
      </div>

      {current ? (
        <div className="mobile-body">
          <div className="scan-target">
            <div className="scan-target-top">
              <span className="scan-target-index">{t('scan.line')} {progressLine} / {lines.length}</span>
              <span className="scan-confirmed">
                <Icon name="check" size={13} />
                {t('scan.confirmed')} {doneCount}/{lines.length}
              </span>
            </div>
            <div className="scan-target-code mono">{current.skuCode}</div>
            <div className="scan-target-name">{current.skuName}</div>
            <div className="scan-target-qty mono">{t('scan.expected')} {current.expectedQty}</div>
          </div>

          <div className="scan-input-row">
            <input
              ref={skuRef}
              className="scan-box scan-field"
              placeholder={t('scan.scanSku')}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={(e) => focusNext(e, locationRef)}
              aria-label={t('scan.scanSku')}
            />
            <button type="button" className="scan-trigger" onClick={() => setScanTarget('sku')} aria-label={t('scan.cameraSku')}>
              <Icon name="scan" size={20} />
            </button>
          </div>
          <div className="scan-wait" aria-live="polite">
            {skuMatch ? (
              <span className="scan-match"><Icon name="check" size={14} />{t('scan.matched')}</span>
            ) : skuMismatch ? (
              <span className="scan-match scan-mismatch"><Icon name="alert" size={14} />{t('scan.mismatch')}</span>
            ) : (
              <>
                {t('scan.waiting')}
                <span className="scan-caret" aria-hidden="true" />
              </>
            )}
          </div>
          <div className="scan-input-row">
            <input
              ref={locationRef}
              className="scan-box scan-field"
              placeholder={t('scan.scanLocation')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => focusNext(e, qtyRef)}
              aria-label={t('scan.scanLocation')}
            />
            <button type="button" className="scan-trigger" onClick={() => setScanTarget('location')} aria-label={t('scan.cameraLocation')}>
              <Icon name="scan" size={20} />
            </button>
          </div>
          <input
            ref={qtyRef}
            className="scan-box scan-field num"
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleConfirm()
              }
            }}
            aria-label={t('scan.qty')}
          />

          <div className="scan-batch-row">
            <input
              className="scan-box scan-field"
              placeholder={t('scan.batchNo')}
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              aria-label={t('scan.batchNo')}
            />
            <input
              className="scan-box scan-field"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              aria-label={t('scan.expiryDate')}
            />
          </div>
          <div className="scan-batch-hint">{t('scan.batchOptional')}</div>

          {error && (
            <p className="scan-error" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </p>
          )}
          {needsRefresh && (
            <button
              type="button"
              className="scan-btn scan-refresh"
              onClick={() => {
                setNeedsRefresh(false)
                setError(null)
                void task.refetch()
              }}
            >
              <Icon name="refresh" size={18} /> {t('scan.refreshTask')}
            </button>
          )}

          <div className="scan-actions">
            <button type="button" className="scan-btn" onClick={() => skuRef.current?.focus()}>
              <Icon name="file" size={19} />{t('scan.manual')}
            </button>
            <button type="button" className="scan-btn" onClick={() => { setSku(''); setLocation(''); setError(null); skuRef.current?.focus() }}>
              <Icon name="refresh" size={19} />{t('scan.rescan')}
            </button>
            <button type="button" className="scan-btn scan-btn-primary" onClick={handleConfirm} disabled={submitting}>
              {submitting ? <><ButtonDots />{t('common.saving')}</> : <><Icon name="check" size={20} />{t('scan.confirmLine')}</>}
            </button>
            <Link to="/m/tasks" className="scan-btn scan-btn-link">
              <Icon name="close" size={19} />{t('common.cancel')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mobile-body mobile-done rise">
          <div className="scan-done-mark"><Icon name="check" size={40} /></div>
          <div className="scan-done-title">{t('scan.allDone')}</div>
          <div className="mono">{doneCount} / {lines.length} {t('scan.linesDone')}</div>
          <Link to="/m/tasks" className="btn btn-primary">
            <Icon name="arrow-left" size={15} />{t('scan.backToTasks')}
          </Link>
        </div>
      )}

      {scanTarget && (
        <BarcodeScanner
          target={scanTarget}
          onDetected={(code) => {
            if (scanTarget === 'sku') {
              setSku(code)
              locationRef.current?.focus()
            } else {
              setLocation(code)
              qtyRef.current?.focus()
            }
            haptic('success')
          }}
          onClose={() => setScanTarget(null)}
        />
      )}
    </div>
  )
}
