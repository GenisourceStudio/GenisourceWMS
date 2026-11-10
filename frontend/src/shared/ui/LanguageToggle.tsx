import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'zh-CN', label: '中' },
  { code: 'en-US', label: 'EN' },
] as const

/**
 * Switches the UI language. i18n keeps <html lang> in sync (shared/i18n),
 * which drives the Chinese/Latin typography rules in global.css.
 */
export function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const current = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US'

  return (
    <div className="lang-toggle" role="group" aria-label={t('scan.language')}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          aria-pressed={current === lang.code}
          onClick={() => void i18n.changeLanguage(lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
