import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../shared/api/http'
import { Icon, TableSkeleton, EmptyState, ButtonDots, useEscapeKey } from '../../shared/ui/Icon'
import { Select } from '../../shared/ui/Select'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  mono?: boolean
}

export interface FormField {
  name: string
  label: string
  /** Locked when editing (identity codes are immutable). */
  immutable?: boolean
  mono?: boolean
  type?: 'text' | 'select'
  options?: { value: string; label: string }[]
  required?: boolean
}

export interface MasterCrudConfig<T extends { id: number }> {
  queryKey: string
  title: string
  columns: Column<T>[]
  fields: FormField[]
  searchPlaceholder: string
  createLabel: string
  editLabel: string
  emptyNote: string
  /** Build the initial form values for a new row. */
  defaults: () => Record<string, string>
  /** Extract form values from an existing row for editing. */
  toForm: (row: T) => Record<string, string>
  list: (keyword: string) => Promise<{ items: T[]; total: number; page: number; size: number }>
  create: (values: Record<string, string>) => Promise<unknown>
  update: (id: number, values: Record<string, string>) => Promise<unknown>
  /** Extra form controls, e.g. active checkbox, rendered above the footer. */
  extraForm?: (ctx: {
    editing: T | null
    values: Record<string, string>
    setValue: (name: string, value: string) => void
  }) => React.ReactNode
}

/**
 * Shared CRUD screen for master data. SKU has its own richer page; locations and
 * partners configure this one. Keeping them on one component means the layout,
 * inline errors and refresh behaviour cannot drift between the three tabs.
 */
export function MasterCrudPage<T extends { id: number }>({ config }: { config: MasterCrudConfig<T> }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<T | null>(null)
  const [creating, setCreating] = useState(false)

  const query = useQuery({
    queryKey: [config.queryKey, search],
    queryFn: () => config.list(search),
  })

  const close = () => {
    setCreating(false)
    setEditing(null)
  }

  return (
    <>
      <div className="page-actions page-actions-right">
        <input
          className="field-input field-input-sm"
          placeholder={config.searchPlaceholder}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch(keyword)
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={() => setSearch(keyword)}>
          <Icon name="search" size={15} />
          {t('sku.search')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} />
          {config.createLabel}
        </button>
      </div>

      <section className="panel panel-flush">
        {query.isLoading ? (
          <TableSkeleton cols={config.columns.length} rows={6} />
        ) : query.isError ? (
          <EmptyState
            tone="error"
            icon="alert"
            title={t('common.loadFailed')}
            note={query.error instanceof ApiError ? query.error.message : t('common.networkError')}
          />
        ) : query.data && query.data.items.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                {config.columns.map((col) => (
                  <th key={col.key} scope="col">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((row) => (
                <tr key={row.id} className="row-clickable" onClick={() => setEditing(row)}>
                  {config.columns.map((col) => (
                    <td key={col.key} className={col.mono ? 'mono cell-code' : undefined}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title={t('common.empty')} note={config.emptyNote} />
        )}
      </section>

      {(creating || editing) && (
        <MasterDrawer<T>
          config={config}
          row={editing}
          onClose={close}
          onSaved={async () => {
            close()
            await queryClient.invalidateQueries({ queryKey: [config.queryKey] })
          }}
        />
      )}
    </>
  )
}

function MasterDrawer<T extends { id: number }>({
  config,
  row,
  onClose,
  onSaved,
}: {
  config: MasterCrudConfig<T>
  row: T | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  useEscapeKey(onClose)
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>(
    row ? config.toForm(row) : config.defaults(),
  )
  const [error, setError] = useState<string | null>(null)

  const setValue = (name: string, value: string) => setValues((prev) => ({ ...prev, [name]: value }))

  const mutation = useMutation({
    mutationFn: () => (row ? config.update(row.id, values) : config.create(values)),
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
          <h2 className="drawer-title">{row ? config.editLabel : config.createLabel}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
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
          {config.fields.map((field) => (
            <label className="field" key={field.name}>
              <span className="field-label">{field.label}</span>
              {field.type === 'select' ? (
                <Select
                  value={values[field.name] ?? ''}
                  onChange={(v) => setValue(field.name, v)}
                  disabled={Boolean(row) && field.immutable}
                  required={field.required}
                  options={(field.options ?? []).map((opt) => ({ value: opt.value, label: opt.label }))}
                />
              ) : (
                <input
                  className={field.mono ? 'field-input mono' : 'field-input'}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  readOnly={Boolean(row) && field.immutable}
                  required={field.required}
                />
              )}
              {field.immutable && row && (
                <span className="field-hint">{t('sku.codeLocked')}</span>
              )}
            </label>
          ))}

          {config.extraForm?.({ editing: row, values, setValue })}

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
              {mutation.isPending ? (
                <>
                  <ButtonDots /> {t('common.saving')}
                </>
              ) : (
                t('common.save')
              )}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
