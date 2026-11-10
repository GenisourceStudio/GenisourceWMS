import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { useAuth } from '../shared/auth/AuthContext'
import { BrandMark } from '../shared/ui/BrandMark'
import { Icon, type IconName } from '../shared/ui/Icon'
import { LanguageToggle } from '../shared/ui/LanguageToggle'

export interface NavItem {
  index: string
  key: string
  path: string
  icon: IconName
  /** Capability required to see this entry; omitted means always visible. */
  permission?: string
}

/**
 * Navigation follows the PRD's five functional areas. The numbering is part of
 * the visual language (two-digit jade index in the rail).
 */
export const NAV_ITEMS: NavItem[] = [
  { index: '01', key: 'nav.dashboard', path: '/', icon: 'dashboard' },
  { index: '02', key: 'nav.skus', path: '/skus', icon: 'box', permission: 'MANAGE_MASTER' },
  { index: '03', key: 'nav.inbound', path: '/inbound-orders', icon: 'inbound', permission: 'MANAGE_ORDER' },
  { index: '04', key: 'nav.outbound', path: '/outbound-orders', icon: 'outbound', permission: 'MANAGE_ORDER' },
  { index: '05', key: 'nav.inventory', path: '/inventory', icon: 'layers', permission: 'VIEW_INVENTORY' },
  { index: '06', key: 'nav.transactions', path: '/inventory/transactions', icon: 'ledger', permission: 'VIEW_INVENTORY' },
  { index: '07', key: 'nav.logs', path: '/operation-logs', icon: 'history', permission: 'VIEW_AUDIT' },
  { index: '08', key: 'nav.users', path: '/users', icon: 'user', permission: 'MANAGE_USER' },
  { index: '09', key: 'nav.stocktakes', path: '/stocktakes', icon: 'layers', permission: 'MANAGE_ORDER' },
  { index: '10', key: 'nav.transfers', path: '/transfers', icon: 'outbound', permission: 'MANAGE_ORDER' },
]

export function AppShell({ version, children }: { version?: string; children: React.ReactNode }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [now, setNow] = useState(() => dayjs())

  // A quiet live clock in the topbar: mono, tabular, one-second cadence.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Hide entries the account cannot use: the backend still enforces them, but a
  // scanner operator should never see console-only navigation.
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || (user?.permissions ?? []).includes(item.permission),
  )

  // Longest matching path wins, so /inventory/transactions does not light up
  // /inventory as well.
  const current = [...visibleItems]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)))

  const initial = user?.displayName?.trim().charAt(0).toUpperCase() ?? '—'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <aside className="shell-rail">
        <div className="shell-brand">
          <BrandMark size={28} />
          <div>
            <div className="shell-brand-name">{t('app.name')}</div>
            <div className="shell-brand-sub">{t('app.subtitle')}</div>
          </div>
        </div>

        <nav className="shell-nav" aria-label={t('app.name')}>
          {visibleItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              // NavLink's prefix matching lights up both /inventory and
              // /inventory/transactions, so the single active item is derived
              // from the longest-match breadcrumb instead.
              aria-current={current?.path === item.path ? 'page' : undefined}
            >
              <span className="shell-nav-index">{item.index}</span>
              <Icon name={item.icon} size={17} />
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="shell-rail-foot">
          <div>v{version ?? '—'}</div>
          <div>Asia/Shanghai</div>
          {user && (
            <>
              <div className="shell-rail-user">{user.displayName}</div>
              <button type="button" className="shell-rail-logout" onClick={handleLogout}>
                <Icon name="logout" size={13} />
                {t('login.logout')}
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              {t('app.name')}
            </span>
            <Icon name="chevron-right" size={13} />
            <span className="topbar-crumb-text">{current ? t(current.key) : t('nav.dashboard')}</span>
          </div>
          <div className="topbar-right">
            <LanguageToggle />
            <span className="topbar-sep" aria-hidden="true" />
            <span className="topbar-clock">
              <Icon name="clock" size={13} />
              <time>{now.format('HH:mm:ss')}</time>
            </span>
            <span className="topbar-sep" aria-hidden="true" />
            <span className="topbar-status">
              <span className="topbar-led" aria-hidden="true" />
              {t('app.status')}
            </span>
            <span className="topbar-sep" aria-hidden="true" />
            {user && (
              <span className="topbar-user">
                <span className="topbar-avatar" aria-hidden="true">{initial}</span>
                {user.displayName}
              </span>
            )}
          </div>
        </header>
        {/* Keying on the pathname replays the rise cascade on every route change
            (design-system.md §8) without touching query state. */}
        <main className="page" key={pathname}>{children}</main>
      </div>
    </div>
  )
}
