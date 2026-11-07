import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../shared/api/http'
import { useAuth } from '../shared/auth/AuthContext'
import { BrandMark, HeroRipple } from '../shared/ui/BrandMark'

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
        </div>

        <div className="login-brand-copy">
          <span className="hero-kicker">{t('login.kicker')}</span>
          <h1 className="login-brand-title">{t('login.brandTitle')}</h1>
          <p className="login-brand-lead">{t('login.brandLead')}</p>
        </div>

        <HeroRipple />
      </aside>

      <main className="login-form">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h2 className="login-title">{t('login.title')}</h2>
          <p className="login-sub">{t('login.subtitle')}</p>

          <label className="field">
            <span className="field-label">{t('login.username')}</span>
            <input
              className="field-input"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">{t('login.password')}</span>
            <input
              className="field-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </main>
    </div>
  )
}
