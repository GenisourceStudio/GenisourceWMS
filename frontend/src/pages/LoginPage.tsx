import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../shared/api/http'
import { useAuth } from '../shared/auth/AuthContext'
import { BrandMark, HeroRipple } from '../shared/ui/BrandMark'
import { ButtonDots, Icon } from '../shared/ui/Icon'
import { LanguageToggle } from '../shared/ui/LanguageToggle'

/** The four brand principles, made visible as hairline rules on the navy panel. */
const PRINCIPLES = [
  { index: '01', en: 'Origin', zh: '源头' },
  { index: '02', en: 'Ripple', zh: '扩散' },
  { index: '03', en: 'Precision', zh: '精密' },
  { index: '04', en: 'Trust', zh: '可信' },
]

/**
 * Split screen: navy brand panel on the left, plain white form on the right.
 * Errors render inline under the fields, never in a modal (design-system.md §6).
 */
export function LoginPage() {
  const { t } = useTranslation()
  const { user, loading, login } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      // The backend deliberately does not distinguish unknown user / disabled /
      // wrong password; the message stays generic here too.
      setError(err instanceof ApiError ? err.message : t('common.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <aside className="login-brand">
        <div className="login-brand-top">
          <BrandMark size={32} />
          <div>
            <div className="shell-brand-name">{t('app.name')}</div>
            <div className="shell-brand-sub">{t('app.subtitle')}</div>
          </div>
          <div className="login-brand-lang"><LanguageToggle /></div>
        </div>

        <div className="login-brand-copy">
          <span className="hero-kicker">{t('login.kicker')}</span>
          <h1 className="login-brand-title">{t('login.brandTitle')}</h1>
          <p className="login-brand-lead">{t('login.brandLead')}</p>
        </div>

        <div className="login-brand-principles" aria-hidden="true">
          {PRINCIPLES.map((item) => (
            <div className="login-brand-principle" key={item.index}>
              <span className="idx">{item.index}</span>
              <span className="en">{item.en}</span>
              <span className="zh">{item.zh}</span>
            </div>
          ))}
        </div>
        <p className="sr-only">品牌原则：源头、扩散、精密、可信。</p>

        <HeroRipple />
      </aside>

      <main className="login-form">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h2 className="login-title">{t('login.title')}</h2>
          <p className="login-sub">{t('login.subtitle')}</p>

          <label className="field">
            <span className="field-label">{t('login.username')}</span>
            <span className="field-wrap">
              <Icon name="user" size={16} className="field-icon" />
              <input
                className="field-input"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </span>
          </label>

          <label className="field">
            <span className="field-label">{t('login.password')}</span>
            <span className="field-wrap">
              <Icon name="lock" size={16} className="field-icon" />
              <input
                className="field-input has-toggle"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="field-toggle"
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                aria-pressed={showPassword}
                onClick={(e) => {
                  // The control lives inside a <label>; suppress the label's
                  // default focus forwarding so the reveal is the only action.
                  e.preventDefault()
                  setShowPassword((visible) => !visible)
                }}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </span>
          </label>

          {error && (
            <p className="field-error" role="alert">
              <Icon name="alert" size={14} />
              {error}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <ButtonDots />
                {t('login.submitting')}
              </>
            ) : (
              <>
                <Icon name="arrow-right" size={15} />
                {t('login.submit')}
              </>
            )}
          </button>

          <div className="login-foot">
            <Icon name="lock" size={13} />
            {t('app.subtitle')}
            <span aria-hidden="true">·</span>
            SECURE SESSION
          </div>
        </form>
      </main>
    </div>
  )
}
