import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from './locales/en-US.json'
import zhCN from './locales/zh-CN.json'

/** Keeps <html lang> in sync so the CSS typography rules can branch on it. */
function syncDocumentLang(language: string): void {
  document.documentElement.lang = language
}

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
})

syncDocumentLang(i18n.language)
i18n.on('languageChanged', syncDocumentLang)

export default i18n
