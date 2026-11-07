import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../shared/api/http'
import { createSku, fetchSkus, updateSku, type Sku } from '../../shared/api/skus'

export function SkuListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Sku | null>(null)
  const [creating, setCreating] = useState(false)

  const query = useQuery({
    queryKey: ['skus', search],
    queryFn: () => fetchSkus(search),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['skus'] })

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.skus')}</h1>
        <div className="page-actions">
          <input
            className="field-input field-input-sm"
            placeholder={t('sku.searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(keyword)
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => setSearch(keyword)}>
            {t('sku.search')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('sku.create')}
          </button>
        </div>
      </div>

      <section className="panel panel-flush">
        {query.isLoading ? (
          <div className="empty">
            <div className="empty-note">{t('common.loading')}</div>
          </div>
        ) : query.isError ? (
          <div className="empty">
            <div className="empty-title">{t('common.loadFailed')}</div>
            <div className="empty-note">
              {query.error instanceof ApiError ? query.error.message : t('common.networkError')}
            </div>
          </div>
        ) : query.data && query.data.items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('sku.colCode')}</th>
                <th scope="col">{t('sku.colName')}</th>
                <th scope="col">{t('sku.colSpec')}</th>
                <th scope="col">{t('sku.colUnit')}</th>
                <th scope="col">{t('sku.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((sku) => (
                <tr key={sku.id} className="row-clickable" onClick={() => setEditing(sku)}>
                  <td className="mono cell-code">{sku.code}</td>
                  <td>{sku.name}</td>
                  <td className="cell-muted">{sku.spec ?? '—'}</td>
                  <td className="cell-muted">{sku.unit ?? '—'}</td>
                  <td>
                    <span className={sku.isActive ? 'status status-ongoing' : 'status status-draft'}>
                      {sku.isActive ? t('sku.active') : t('sku.inactive')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <div className="empty-title">{t('common.empty')}</div>
            <div className="empty-note">{t('sku.emptyNote')}</div>
          </div>
        )}
      </section>

      {(creating || editing) && (
        <SkuDrawer
          sku={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setCreating(false)
            setEditing(null)
            await invalidate()
          }}
        />
      )}
    </>
  )
}

/** Create and edit share one drawer; code is read-only when editing. */
function SkuDrawer({
  sku,
  onClose,
  onSaved,
}: {
  sku: Sku | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState(sku?.code ?? '')
  const [name, setName] = useState(sku?.name ?? '')
  const [spec, setSpec] = useState(sku?.spec ?? '')
  const [unit, setUnit] = useState(sku?.unit ?? '')
  const [isActive, setIsActive] = useState(sku?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (sku) {
        return updateSku(sku.id, { name, spec: spec || undefined, unit: unit || undefined, isActive })
      }
      return createSku({ code, name, spec: spec || undefined, unit: unit || undefined })
    },
    onSuccess: async () => {
      await onSaved()
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t('common.networkError'))
    },
  })

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="drawer-title">{sku ? t('sku.edit') : t('sku.create')}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <form
          className="drawer-body"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            mutation.mutate()
          }}
        >
          <label className="field">
            <span className="field-label">{t('sku.code')}</span>
            <input
              className="field-input mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              readOnly={Boolean(sku)}
              required
              autoFocus={!sku}
            />
            <span className="field-hint">{sku ? t('sku.codeLocked') : t('sku.codeHint')}</span>
          </label>

          <label className="field">
            <span className="field-label">{t('sku.name')}</span>
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">{t('sku.spec')}</span>
            <input className="field-input" value={spec} onChange={(e) => setSpec(e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">{t('sku.unit')}</span>
            <input className="field-input" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>

          {sku && (
            <label className="field field-inline">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>{t('sku.activeLabel')}</span>
            </label>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <div className="drawer-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
