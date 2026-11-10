import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import {
  fetchInventory, fetchTransactions,
  type InventoryQuery, type TxnQuery,
} from '../../shared/api/inventory'
import { Icon, TableSkeleton, EmptyState } from '../../shared/ui/Icon'
import { Pagination } from '../../shared/ui/Pagination'

const PAGE_SIZE = 20

/** C3: stock / ledger views with combined filters and real pagination. */
export function InventoryPage({ mode }: { mode: 'stock' | 'ledger' }) {
  const { t } = useTranslation()
  const isStock = mode === 'stock'
  const [page, setPage] = useState(0)

  // Stock filters
  const [keyword, setKeyword] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [stockQuery, setStockQuery] = useState<InventoryQuery>({})

  // Ledger filters
  const [orderNo, setOrderNo] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [locationId, setLocationId] = useState('')
  const [txnQuery, setTxnQuery] = useState<TxnQuery>({})

  const stock = useQuery({
    queryKey: ['inventory', stockQuery, page],
    queryFn: () => fetchInventory({ ...stockQuery, page, size: PAGE_SIZE }),
    enabled: isStock,
  })
  const txns = useQuery({
    queryKey: ['transactions', txnQuery, page],
    queryFn: () => fetchTransactions({ ...txnQuery, page, size: PAGE_SIZE }),
    enabled: !isStock,
  })

  const query = isStock ? stock : txns
  const data = isStock ? stock.data : txns.data

  function applyStock() {
    setPage(0)
    setStockQuery({
      keyword: keyword.trim() || undefined,
      lowStockOnly: lowOnly || undefined,
      threshold: lowOnly ? 5 : undefined,
    })
  }

  function applyTxn() {
    setPage(0)
    setTxnQuery({
      orderNo: orderNo.trim() || undefined,
      type: type || undefined,
      from: from || undefined,
      to: to || undefined,
      locationId: locationId || undefined,
    })
  }

  function reset() {
    setPage(0)
    if (isStock) {
      setKeyword(''); setLowOnly(false); setStockQuery({})
    } else {
      setOrderNo(''); setType(''); setFrom(''); setTo(''); setLocationId(''); setTxnQuery({})
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{isStock ? t('nav.inventory') : t('nav.transactions')}</h1>
      </div>

      <div className="filter-bar">
        {isStock ? (
          <>
            <input
              className="field-input field-input-sm"
              placeholder={t('inventory.searchPlaceholder')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyStock() }}
            />
            <label className="filter-check">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              {t('inventory.lowStockOnly')}
            </label>
          </>
        ) : (
          <>
            <input
              className="field-input field-input-sm"
              placeholder={t('inventory.orderNoPlaceholder')}
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyTxn() }}
            />
            <select className="field-input field-input-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t('inventory.allTypes')}</option>
              <option value="INBOUND">{t('inventory.inbound')}</option>
              <option value="OUTBOUND">{t('inventory.outbound')}</option>
            </select>
            <input
              className="field-input field-input-sm"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label={t('inventory.from')}
            />
            <input
              className="field-input field-input-sm"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t('inventory.to')}
            />
            <input
              className="field-input field-input-sm"
              placeholder={t('inventory.locationId')}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            />
          </>
        )}
        <button type="button" className="btn btn-secondary" onClick={isStock ? applyStock : applyTxn}>
          <Icon name="search" size={15} /> {t('sku.search')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={reset}>
          <Icon name="refresh" size={15} /> {t('inventory.reset')}
        </button>
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
                    <td className={`num mono inventory-qty ${item.qty <= 5 ? 'qty-low' : ''}`}>
                      {item.qty}
                      {item.qty <= 5 && <span className="qty-flag" title={t('inventory.lowStock')}>!</span>}
                    </td>
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

      {data && (
        <Pagination page={page} size={PAGE_SIZE} total={data.total} onChange={setPage} />
      )}
    </>
  )
}
