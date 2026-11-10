import { useTranslation } from 'react-i18next'

/** Shared pager. `total` comes from the backend PageResponse. */
export function Pagination({
  page,
  size,
  total,
  onChange,
}: {
  page: number
  size: number
  total: number
  onChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, total)

  if (total <= size) {
    return null
  }

  return (
    <div className="pagination">
      <span className="pagination-info mono">
        {from}–{to} / {total} {t('pagination.rows')}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
        >
          ← {t('pagination.prev')}
        </button>
        <span className="pagination-page mono">
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        >
          {t('pagination.next')} →
        </button>
      </div>
    </div>
  )
}
