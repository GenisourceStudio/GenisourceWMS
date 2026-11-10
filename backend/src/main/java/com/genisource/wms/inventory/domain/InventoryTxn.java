package com.genisource.wms.inventory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * Append-only ledger. Rows are never UPDATEd or DELETEd; the aggregate of
 * qty_delta must always equal inventory.qty (checked by check-ledger.mjs).
 */
@Entity
@Table(name = "inventory_txn")
public class InventoryTxn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    @Column(nullable = false)
    private String type;

    @Column(name = "sku_id", nullable = false)
    private Long skuId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "qty_delta", nullable = false)
    private int qtyDelta;

    @Column(name = "qty_after", nullable = false)
    private int qtyAfter;

    @Column(name = "order_type", nullable = false)
    private String orderType;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "order_no", nullable = false)
    private String orderNo;

    @Column(name = "line_id", nullable = false)
    private Long lineId;

    /** Null for legacy movements that predate batch tracking (V4). */
    @Column(name = "batch_id")
    private Long batchId;

    @Column(name = "operator_id")
    private Long operatorId;

    private String remark;

    protected InventoryTxn() {
    }

    public InventoryTxn(
            String type, Long skuId, Long locationId, int qtyDelta, int qtyAfter,
            String orderType, Long orderId, String orderNo, Long lineId, Long operatorId, String remark) {
        this(type, skuId, locationId, qtyDelta, qtyAfter, orderType, orderId, orderNo,
                lineId, null, operatorId, remark);
    }

    public InventoryTxn(
            String type, Long skuId, Long locationId, int qtyDelta, int qtyAfter,
            String orderType, Long orderId, String orderNo, Long lineId, Long batchId,
            Long operatorId, String remark) {
        this.occurredAt = OffsetDateTime.now();
        this.type = type;
        this.skuId = skuId;
        this.locationId = locationId;
        this.qtyDelta = qtyDelta;
        this.qtyAfter = qtyAfter;
        this.orderType = orderType;
        this.orderId = orderId;
        this.orderNo = orderNo;
        this.lineId = lineId;
        this.batchId = batchId;
        this.operatorId = operatorId;
        this.remark = remark;
    }

    public int getQtyDelta() {
        return qtyDelta;
    }
}
