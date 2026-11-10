import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { ApiError } from '../../shared/api/http'
import { fetchOutboundOrder, type OrderStatus } from '../../shared/api/outbound'
import { Icon, TableSkeleton, EmptyState } from '../../shared/ui/Icon'
import { OrderActions } from '../orders/OrderActions'

const STATUS_CLASS: Record<OrderStatus, string> = {
  DRAFT: 'status-draft',
  PARTIAL: 'status-ongoing',
  COMPLETED: 'status-done',
}

export function OutboundOrderDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const order = useQuery({
    queryKey: ['outbound-order', orderId],
    queryFn: () => fetchOutboundOrder(orderId),
    enabled: Number.isFinite(orderId),
  })

  if (order.isLoading) return <div className="panel panel-flush"><TableSkeleton cols={4} rows={4} /></div>
  if (order.isError || !order.data) {
    return (
      <EmptyState
        tone="error"
        icon="alert"
        title={t('common.loadFailed')}
        note={order.error instanceof ApiError ? order.error.message : t('common.networkError')}
      />
    )
  }

  const data = order.data
  const done = data.lines.filter((l) => l.status === 'DONE').length
  const progress = data.lines.length ? Math.round((done / data.lines.length) * 100) : 0

  return (
    <>
      <div className="detail-head">
        <Link to="/outbound-orders" className="text-link"><Icon name="arrow-left" size={14} /> {t('order.backToList')}</Link>
        <Icon name="file" size={20} />
        <h1 className="page-title mono">{data.orderNo}</h1>
        <span className={`status ${STATUS_CLASS[data.status]}`}>{t(`order.${data.status.toLowerCase()}`)}</span>
      </div>

      {data.status === 'DRAFT' && (
        <OrderActions
          kind="outbound"
          order={data}
          onChanged={async () => {
            await queryClient.invalidateQueries({ queryKey: ['outbound-order', orderId] })
            await queryClient.invalidateQueries({ queryKey: ['outbound-orders'] })
          }}
          onDeleted={() => {
            void queryClient.invalidateQueries({ queryKey: ['outbound-orders'] })
            navigate('/outbound-orders', { replace: true })
          }}
        />
      )}

      <section className="panel">
        <div className="detail-meta">
          <div><span className="field-label">{t('order.customer')}</span><span>{data.partnerName}</span></div>
          <div><span className="field-label">{t('order.colCreated')}</span><span className="mono">{dayjs(data.createdAt).format('YYYY.MM.DD HH:mm')}</span></div>
          <div><span className="field-label">{t('order.remark')}</span><span>{data.remark ?? '—'}</span></div>
        </div>
        <div className="progress-wrap">
          <span className="progress-label">{t('order.colProgress')}</span>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <span className="mono">{done} / {data.lines.length} {t('order.linesDone')}</span>
        </div>
      </section>

      <section className="panel panel-flush">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t('sku.colCode')}</th>
              <th scope="col">{t('sku.colName')}</th>
              <th scope="col" className="num">{t('order.colExpected')}</th>
              <th scope="col" className="num">{t('order.colConfirmed')}</th>
              <th scope="col">{t('order.colLocation')}</th>
              <th scope="col">{t('sku.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, index) => (
              <tr key={line.id}>
                <td className="mono cell-muted">{index + 1}</td>
                <td className="mono cell-code">{line.skuCode}</td>
                <td>{line.skuName}</td>
                <td className="num mono">{line.expectedQty}</td>
                <td className="num mono">{line.confirmedQty}</td>
                <td className="mono cell-muted">{line.locationCode ?? '—'}</td>
                <td>
                  <span className={line.status === 'DONE' ? 'status status-done' : 'status status-draft'}>
                    {line.status === 'DONE' ? t('order.lineDone') : t('order.linePending')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
