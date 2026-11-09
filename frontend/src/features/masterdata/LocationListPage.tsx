import { useTranslation } from 'react-i18next'
import { createLocation, fetchLocations, updateLocation, type Location } from '../../shared/api/locations'
import { MasterCrudPage, type MasterCrudConfig } from './MasterCrudPage'

export function LocationListPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()

  const config: MasterCrudConfig<Location> = {
    queryKey: 'locations',
    title: t('master.tabLocation'),
    searchPlaceholder: t('location.searchPlaceholder'),
    createLabel: t('location.create'),
    editLabel: t('location.edit'),
    emptyNote: t('location.emptyNote'),
    columns: [
      { key: 'code', label: t('location.code'), mono: true, render: (r) => r.code },
      { key: 'area', label: t('location.area'), render: (r) => r.area ?? '—' },
      { key: 'remark', label: t('location.remark'), render: (r) => r.remark ?? '—' },
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
      { name: 'code', label: t('location.code'), immutable: true, mono: true, required: true },
      { name: 'area', label: t('location.area') },
      { name: 'remark', label: t('location.remark') },
    ],
    defaults: () => ({ code: '', area: '', remark: '', isActive: 'true' }),
    toForm: (r) => ({
      code: r.code,
      area: r.area ?? '',
      remark: r.remark ?? '',
      isActive: String(r.isActive),
    }),
    list: (keyword) => fetchLocations(keyword),
    create: (v) => createLocation({ code: v.code, area: v.area, remark: v.remark }),
    update: (id, v) =>
      updateLocation(id, {
        area: v.area,
        remark: v.remark,
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
          <h1 className="page-title">{t('master.tabLocation')}</h1>
        </div>
      )}
      <MasterCrudPage config={config} />
    </>
  )
}
