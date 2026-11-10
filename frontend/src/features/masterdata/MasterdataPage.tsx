import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from '../../shared/ui/Icon'
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

  const tabs: { key: MasterTab; label: string; icon: IconName }[] = [
    { key: 'sku', label: t('master.tabSku'), icon: 'box' },
    { key: 'location', label: t('master.tabLocation'), icon: 'layers' },
    { key: 'partner', label: t('master.tabPartner'), icon: 'user' },
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
              <Icon name={item.icon} size={15} />
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
