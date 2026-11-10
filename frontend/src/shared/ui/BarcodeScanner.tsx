import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Camera barcode scanner with three fallback levels (SDD §2.1):
 *   1. native BarcodeDetector (Chrome / Android)
 *   2. @zxing/browser (iOS Safari and others without the native API)
 *   3. manual entry — the caller keeps the input field available, so a denied
 *      camera or a damaged label is an equivalent path, never a dead end.
 *
 * Camera access requires a secure context (HTTPS, or localhost in dev).
 */

interface NativeDetectionResult {
  rawValue: string
}

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<NativeDetectionResult[]>
}

type DetectorConstructor = new (options?: { formats?: string[] }) => NativeDetector

export type ScanTarget = 'sku' | 'location'

export interface BarcodeScannerProps {
  target: ScanTarget
  onDetected: (code: string) => void
  onClose: () => void
}

const FORMATS = [
  'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8',
  'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix',
]

export function BarcodeScanner({ target, onDetected, onClose }: BarcodeScannerProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const timerRef = useRef<number | null>(null)
  const stopRef = useRef<() => void>(() => {})
  const doneRef = useRef(false)
  // Parent callbacks are recreated on every render; keeping them in a ref lets
  // the camera effect run exactly once instead of restarting on each render.
  const callbacksRef = useRef({ onDetected, onClose })
  callbacksRef.current = { onDetected, onClose }

  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState('')

  useEffect(() => {
    let cancelled = false

    const stopAll = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      controlsRef.current?.stop()
      controlsRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    stopRef.current = stopAll

    const finish = (code: string) => {
      if (doneRef.current || cancelled) return
      doneRef.current = true
      stopAll()
      callbacksRef.current.onDetected(code)
      callbacksRef.current.onClose()
    }

    async function start() {
      try {
        const Native = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector

        if (Native) {
          // --- Level 1: native detector, we own the stream.
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          streamRef.current = stream
          const video = videoRef.current
          if (!video) return
          video.srcObject = stream
          await video.play()

          const detector = new Native({ formats: FORMATS })
          setEngine('BarcodeDetector')
          setStatus('scanning')
          timerRef.current = window.setInterval(async () => {
            if (doneRef.current || cancelled) return
            try {
              const results = await detector.detect(video)
              if (results.length > 0 && results[0].rawValue) {
                finish(results[0].rawValue)
              }
            } catch {
              // A single frame may fail to decode; keep scanning.
            }
          }, 250)
        } else {
          // --- Level 2: ZXing manages its own stream; controls.stop() releases it.
          // Loaded lazily: devices with the native API never download this chunk.
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (cancelled) return
          setEngine('ZXing')
          const reader = new BrowserMultiFormatReader()
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            videoRef.current ?? undefined,
            (result) => {
              if (result && !doneRef.current) {
                finish(result.getText())
              }
            },
          )
          if (cancelled) {
            controls.stop()
            return
          }
          controlsRef.current = controls
          setStatus('scanning')
        }
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        const reason = e instanceof Error ? e.message : String(e)
        setError(reason)
      }
    }

    void start()
    return () => {
      cancelled = true
      stopAll()
    }
  }, [])

  function close() {
    doneRef.current = true
    stopRef.current()
    callbacksRef.current.onClose()
  }

  return (
    <div className="scan-overlay" role="dialog" aria-modal="true" aria-label={t('scan.cameraTitle')}>
      <div className="scan-overlay-head">
        <div>
          <div className="scan-overlay-title">
            {target === 'sku' ? t('scan.cameraSku') : t('scan.cameraLocation')}
          </div>
          <div className="scan-overlay-sub mono">{engine || t('scan.cameraStarting')}</div>
        </div>
        <button type="button" className="scan-overlay-close" onClick={close} aria-label={t('common.close')}>
          ×
        </button>
      </div>

      <div className="scan-viewport">
        <video ref={videoRef} className="scan-video" playsInline muted />
        <div className="scan-reticle" aria-hidden="true">
          <span className="scan-reticle-line" />
        </div>
      </div>

      {status === 'error' ? (
        <div className="scan-overlay-foot">
          <p className="scan-overlay-error" role="alert">
            {t('scan.cameraUnavailable')}
            {error ? ` (${error})` : ''}
          </p>
          <p className="scan-overlay-hint">{t('scan.cameraFallbackHint')}</p>
        </div>
      ) : (
        <div className="scan-overlay-foot">
          <p className="scan-overlay-hint">{t('scan.cameraHint')}</p>
        </div>
      )}

      <div className="scan-overlay-actions">
        <button type="button" className="scan-btn" onClick={close}>
          {t('scan.manual')}
        </button>
      </div>
    </div>
  )
}
