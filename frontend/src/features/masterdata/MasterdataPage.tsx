import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SkuListPage } from './SkuListPage'
import { LocationListPage } from './LocationListPage'
import { PartnerListPage } from './PartnerListPage'

export type MasterTab = 'sku' | 'location' | 'partner'

/**
 * The PRD groups SKU / location / partner under one "基础资料" area, so all
 * three share a page with a segmented tab control (design-system.md §5.4).
 */
export function MasterdataPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<MasterTab>('sku')

  const tabs: { key: MasterTab; label: string }[] = [
    { key: 'sku', label: t('master.tabSku') },
    { key: 'location', label: t('master.tabLocation') },
    { key: 'partner', label: t('master.tabPartner') },
  ]

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.skus')}</h1>
        <div className="tabs" role="tablist" aria-label={t('nav.skus')}>
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? 'tab is-active' : 'tab'}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'sku' && <SkuListPage embedded />}
      {tab === 'location' && <LocationListPage embedded />}
      {tab === 'partner' && <PartnerListPage embedded />}
    </>
  )
}
