import { useRef, useEffect, type ReactNode, type SVGProps } from 'react'

/**
 * The single icon set for WMS (design-system.md §10.1). Every glyph is drawn on
 * a 24×24 grid with the brand's 1.5px round stroke, applied in global.css via
 * --gs-icon-stroke. Colour is always inherited from currentColor, so no
 * component ever hard-codes a colour.
 */
export type IconName =
  | 'dashboard'
  | 'box'
  | 'inbound'
  | 'outbound'
  | 'layers'
  | 'ledger'
  | 'history'
  | 'plus'
  | 'search'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'close'
  | 'check'
  | 'eye'
  | 'eye-off'
  | 'logout'
  | 'clock'
  | 'user'
  | 'database'
  | 'activity'
  | 'alert'
  | 'inbox'
  | 'scan'
  | 'refresh'
  | 'dots'
  | 'lock'
  | 'file'

const GLYPHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  box: (
    <>
      <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" />
      <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
    </>
  ),
  inbound: (
    <>
      <path d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  outbound: (
    <>
      <path d="M12 21V11m0 0 3.5 3.5M12 11 8.5 14.5" />
      <path d="M4 16v-3m0 3a2 2 0 0 1 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  ledger: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3 9" />
      <path d="M3 4v5h5M12 7.5V12l3.2 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  'arrow-left': <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14m0 0-6-6m6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  eye: (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.4M6.3 7.5A17 17 0 0 0 2.5 12S6 18 12 18a9.8 9.8 0 0 0 3.3-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="m14 8 4 4-4 4M18 12H9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9.5v4.5M12 17h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 4h16l2 10v6H2v-6L4 4Z" />
      <path d="M2 14h6l1.5 2h5L16 14h6" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M4 12h16" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-2.2 6M20 5v6h-6" />,
  dots: <path d="M6 12h.01M12 12h.01M18 12h.01" />,
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  file: (
    <>
      <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10l-7-7Z" />
      <path d="M13 3v7h7M8 14h8M8 17.5h5" />
    </>
  ),
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 18, className = '', ...rest }: IconProps) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {GLYPHS[name]}
    </svg>
  )
}

/** Closes a drawer on Escape. The callback is kept in a ref so an inline arrow
 *  function does not re-register the listener on every render. */
export function useEscapeKey(onEscape: () => void) {
  const ref = useRef(onEscape)
  ref.current = onEscape
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') ref.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}

/** Breathing placeholder rows. No gradient, no shimmer — just the brand pulse
 *  on --gs-subtle blocks (design-system.md §3.3, §8). */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div className="skeleton-row" key={r} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => (
            <span className="skeleton-cell" key={c} />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

/** One empty/error treatment for every table: a hairline mark, a navy title and
 *  a muted note. Never animated with rotation or texture (§5.3). */
export function EmptyState({
  title,
  note,
  icon = 'inbox',
  tone = 'neutral',
}: {
  title: string
  note?: string
  icon?: IconName
  tone?: 'neutral' | 'error'
}) {
  return (
    <div className={`empty ${tone === 'error' ? 'empty-error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <span className="empty-mark" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="empty-title">{title}</div>
      {note && <div className="empty-note">{note}</div>}
    </div>
  )
}

/** Three-step loading dots used inside buttons; driven only by opacity so it
 *  stays inside the motion contract (§8). */
export function ButtonDots() {
  return (
    <span className="btn-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

