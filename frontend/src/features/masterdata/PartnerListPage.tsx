import { useTranslation } from 'react-i18next'
import { createPartner, fetchPartners, updatePartner, type Partner } from '../../shared/api/partners'
import { MasterCrudPage, type MasterCrudConfig } from './MasterCrudPage'

export function PartnerListPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()

  const config: MasterCrudConfig<Partner> = {
    queryKey: 'partners',
    title: t('master.tabPartner'),
    searchPlaceholder: t('partner.searchPlaceholder'),
    createLabel: t('partner.create'),
    editLabel: t('partner.edit'),
    emptyNote: t('partner.emptyNote'),
    columns: [
      { key: 'code', label: t('partner.code'), mono: true, render: (r) => r.code },
      { key: 'name', label: t('partner.name'), render: (r) => r.name },
      {
        key: 'type',
        label: t('partner.type'),
        render: (r) => (r.type === 'SUPPLIER' ? t('partner.supplier') : t('partner.customer')),
      },
      { key: 'contact', label: t('partner.contact'), render: (r) => r.contact ?? '—' },
      {
        key: 'status',
        label: t('sku.colStatus'),
        render: (r) => (
          <span className={r.isActive ? 'status status-ongoing' : 'status status-draft'}>
            {r.isActive ? t('sku.active') : t('sku.inactive')}
          </span>
        ),
      },
    ],
    fields: [
      { name: 'code', label: t('partner.code'), immutable: true, mono: true, required: true },
      { name: 'name', label: t('partner.name'), required: true },
      {
        name: 'type',
        label: t('partner.type'),
        type: 'select',
        immutable: true,
        required: true,
        options: [
          { value: 'SUPPLIER', label: t('partner.supplier') },
          { value: 'CUSTOMER', label: t('partner.customer') },
        ],
      },
      { name: 'contact', label: t('partner.contact') },
    ],
    defaults: () => ({ code: '', name: '', type: 'SUPPLIER', contact: '', isActive: 'true' }),
    toForm: (r) => ({
      code: r.code,
      name: r.name,
      type: r.type,
      contact: r.contact ?? '',
      isActive: String(r.isActive),
    }),
    list: (keyword) => fetchPartners(undefined, keyword),
    create: (v) =>
      createPartner({
        code: v.code,
        name: v.name,
        type: v.type as 'SUPPLIER' | 'CUSTOMER',
        contact: v.contact,
      }),
    update: (id, v) =>
      updatePartner(id, {
        name: v.name,
        contact: v.contact,
        isActive: v.isActive !== 'false',
      }),
    extraForm: ({ editing, values, setValue }) =>
      editing ? (
        <label className="field field-inline">
          <input
            type="checkbox"
            checked={values.isActive !== 'false'}
            onChange={(e) => setValue('isActive', String(e.target.checked))}
          />
          <span>{t('sku.activeLabel')}</span>
        </label>
      ) : null,
  }

  return (
    <>
      {!embedded && (
        <div className="page-head">
          <h1 className="page-title">{t('master.tabPartner')}</h1>
        </div>
      )}
      <MasterCrudPage config={config} />
    </>
  )
}
