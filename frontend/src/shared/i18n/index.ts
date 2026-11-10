import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from './locales/en-US.json'
import zhCN from './locales/zh-CN.json'

const STORAGE_KEY = 'genisource.wms.language'

/** Keeps <html lang> in sync so the CSS typography rules can branch on it. */
function syncDocumentLang(language: string): void {
  document.documentElement.lang = language
}

function initialLanguage(): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en-US' || stored === 'zh-CN' ? stored : 'zh-CN'
}

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: initialLanguage(),
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
})

syncDocumentLang(i18n.language)
i18n.on('languageChanged', (language) => {
  localStorage.setItem(STORAGE_KEY, language)
  syncDocumentLang(language)
})

export default i18n
