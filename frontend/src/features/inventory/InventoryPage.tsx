import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import { fetchInventory, fetchTransactions } from '../../shared/api/inventory'
import { Icon, TableSkeleton, EmptyState } from '../../shared/ui/Icon'

export function InventoryPage({ mode }: { mode: 'stock' | 'ledger' }) {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')

  const stock = useQuery({
    queryKey: ['inventory', search],
    queryFn: () => fetchInventory(search),
    enabled: mode === 'stock',
  })
  const txns = useQuery({
    queryKey: ['transactions', search],
    queryFn: () => fetchTransactions(search ? { orderNo: search } : undefined),
    enabled: mode === 'ledger',
  })

  const query = mode === 'stock' ? stock : txns
  const isStock = mode === 'stock'

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{isStock ? t('nav.inventory') : t('nav.transactions')}</h1>
        <div className="page-actions">
          <input
            className="field-input field-input-sm"
            placeholder={isStock ? t('inventory.searchPlaceholder') : t('inventory.orderNoPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(keyword) }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => setSearch(keyword)}>
            <Icon name="search" size={15} /> {t('sku.search')}
          </button>
        </div>
      </div>

      <section className="panel panel-flush">
        {query.isLoading ? (
          <TableSkeleton cols={isStock ? 5 : 8} rows={6} />
        ) : query.isError ? (
          <EmptyState
            tone="error"
            icon="alert"
            title={t('common.loadFailed')}
            note={query.error instanceof ApiError ? query.error.message : t('common.networkError')}
          />
        ) : isStock && stock.data ? (
          stock.data.items.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('sku.colCode')}</th>
                  <th scope="col">{t('sku.colName')}</th>
                  <th scope="col">{t('order.colLocation')}</th>
                  <th scope="col" className="num">{t('inventory.qty')}</th>
                  <th scope="col">{t('inventory.updatedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {stock.data.items.map((item) => (
                  <tr key={`${item.skuId}-${item.locationId}`}>
                    <td className="mono cell-code">{item.skuCode}</td>
                    <td>{item.skuName}</td>
                    <td className="mono">{item.locationCode}</td>
                    <td className="num mono inventory-qty">{item.qty}</td>
                    <td className="mono cell-muted">{dayjs(item.updatedAt).format('YYYY.MM.DD HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title={t('common.empty')} note={t('inventory.emptyNote')} />
          )
        ) : !isStock && txns.data ? (
          txns.data.items.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('inventory.time')}</th>
                  <th scope="col">{t('inventory.type')}</th>
                  <th scope="col">{t('sku.colCode')}</th>
                  <th scope="col">{t('order.colLocation')}</th>
                  <th scope="col" className="num">{t('inventory.delta')}</th>
                  <th scope="col" className="num">{t('inventory.qtyAfter')}</th>
                  <th scope="col">{t('order.colNo')}</th>
                  <th scope="col">{t('inventory.operator')}</th>
                </tr>
              </thead>
              <tbody>
                {txns.data.items.map((txn) => (
                  <tr key={txn.id}>
                    <td className="mono cell-muted">{dayjs(txn.occurredAt).format('MM.DD HH:mm:ss')}</td>
                    <td>
                      <span className={txn.type === 'INBOUND' ? 'status status-done' : 'status status-draft'}>
                        {txn.type === 'INBOUND' ? t('inventory.inbound') : t('inventory.outbound')}
                      </span>
                    </td>
                    <td className="mono cell-code">{txn.skuCode}</td>
                    <td className="mono">{txn.locationCode}</td>
                    <td className={`num mono ${txn.qtyDelta > 0 ? 'delta-up' : 'delta-down'}`}>{txn.qtyDelta > 0 ? `+${txn.qtyDelta}` : txn.qtyDelta}</td>
                    <td className="num mono">{txn.qtyAfter}</td>
                    <td className="mono cell-muted">{txn.orderNo}</td>
                    <td>{txn.operatorName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title={t('common.empty')} note={t('inventory.ledgerEmptyNote')} />
          )
        ) : null}
      </section>
    </>
  )
}
