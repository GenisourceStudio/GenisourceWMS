import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../shared/api/http'
import { fetchOutboundTask, confirmOutboundLine } from '../../shared/api/outbound'
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

/** Mobile outbound job — identical terminal pattern, plus live pick hints. */
export function OutboundJobPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const queryClient = useQueryClient()

  const task = useQuery({
    queryKey: ['outbound-task', orderId],
    queryFn: () => fetchOutboundTask(orderId),
    enabled: Number.isFinite(orderId),
  })

  const [sku, setSku] = useState('')
  const [location, setLocation] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [tokens, setTokens] = useState<Record<number, string>>({})
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null)
  const skuRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const lines = task.data?.lines ?? []
  const doneCount = lines.filter((l) => l.status === 'DONE').length
  const current = lines.find((l) => l.status === 'PENDING') ?? null
  const progressLine = current ? doneCount + 1 : doneCount
  const progressPct = lines.length ? (doneCount / lines.length) * 100 : 0

  const skuTyped = sku.trim()
  const skuMatch = current ? skuTyped.length > 0 && skuTyped === current.skuCode : false
  const skuMismatch = current ? skuTyped.length >= current.skuCode.length && !skuMatch : false

  useEffect(() => {
    if (current) {
      setQty(String(current.expectedQty))
      setSku('')
      setError(null)
      // Prefill the first suggested location to make scanning faster; the
      // operator can still override it.
      setLocation(current.pickLocations[0]?.locationCode ?? '')
      skuRef.current?.focus()
      setTokens((prev) => prev[current.id] ? prev : { ...prev, [current.id]: crypto.randomUUID() })
    }
  }, [current?.id])

  async function handleConfirm() {
    if (!current || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await confirmOutboundLine(orderId, current.id, {
        skuCode: sku.trim(),
        locationCode: location.trim(),
        qty: Number(qty),
        clientToken: tokens[current.id] ?? crypto.randomUUID(),
      })
      haptic([30, 40, 30])
      setTokens((prev) => {
        const next = { ...prev }
        delete next[current.id]
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['outbound-task', orderId] })
      await queryClient.invalidateQueries({ queryKey: ['outbound-orders'] })
    } catch (err) {
      haptic(80)
      setError(err instanceof ApiError ? err.message : t('common.networkError'))
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
            {current.pickLocations.length > 0 && (
              <div className="scan-picks mono">
                <Icon name="layers" size={14} />
                {t('scan.pickHint')}: {current.pickLocations.map((p) => `${p.locationCode} (${p.available})`).join(' · ')}
              </div>
            )}
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

          {error && (
            <p className="scan-error" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </p>
          )}

          <div className="scan-actions">
            <button type="button" className="scan-btn" onClick={() => skuRef.current?.focus()}>
              <Icon name="file" size={19} />{t('scan.manual')}
            </button>
            <button type="button" className="scan-btn" onClick={() => { setSku(''); setError(null); skuRef.current?.focus() }}>
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
