import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../shared/auth/AuthContext'
import { BrandMark } from '../shared/ui/BrandMark'

export interface NavItem {
  index: string
  key: string
  path: string
}

/**
 * Navigation follows the PRD's five functional areas. The numbering is part of
 * the visual language (two-digit jade index in the rail).
 */
export const NAV_ITEMS: NavItem[] = [
  { index: '01', key: 'nav.dashboard', path: '/' },
  { index: '02', key: 'nav.skus', path: '/skus' },
  { index: '03', key: 'nav.inbound', path: '/inbound-orders' },
  { index: '04', key: 'nav.outbound', path: '/outbound-orders' },
  { index: '05', key: 'nav.inventory', path: '/inventory' },
  { index: '06', key: 'nav.transactions', path: '/inventory/transactions' },
  { index: '07', key: 'nav.logs', path: '/operation-logs' },
]

export function AppShell({ version, children }: { version?: string; children: React.ReactNode }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Longest matching path wins, so /inventory/transactions does not light up
  // /inventory as well.
  const current = [...NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)))

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
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}>
              <span className="shell-nav-index">{item.index}</span>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="shell-rail-foot">
          <div>v{version ?? '—'}</div>
          <div>Asia/Shanghai</div>
          {user && (
            <>
              <div className="shell-rail-user">{user.displayName}</div>
              <button type="button" className="shell-rail-logout" onClick={handleLogout}>
                {t('login.logout')}
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            {current ? t(current.key) : t('nav.dashboard')}
          </span>
          <span className="topbar-status">
            <span className="topbar-led" aria-hidden="true" />
            {t('app.status')}
          </span>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  )
}
