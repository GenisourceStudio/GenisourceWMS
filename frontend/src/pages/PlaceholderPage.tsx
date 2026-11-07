import { useTranslation } from 'react-i18next'

/** Placeholder for areas that land in later slices. Kept honest: no fake data. */
export function PlaceholderPage({ navKey }: { navKey: string }) {
  const { t } = useTranslation()

  return (
    <section className="panel rise">
      <div className="panel-head">
        <h1 className="panel-title">
          <span className="panel-index">—</span>
          {t(navKey)}
        </h1>
      </div>
      <div className="empty">
        <div className="empty-title">{t('common.empty')}</div>
        <div className="empty-note">{t('common.emptyNote')}</div>
      </div>
    </section>
  )
}
