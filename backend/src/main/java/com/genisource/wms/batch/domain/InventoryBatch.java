package com.genisource.wms.batch.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * Batch-level stock truth at (sku, location, batch). Kept in sync with the
 * aggregated `inventory` table inside the same transaction by
 * BatchService.applyDelta — both are written through InventoryService.
 */
@Entity
@Table(name = "inventory_batch")
public class InventoryBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sku_id", nullable = false)
    private Long skuId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(nullable = false)
    private int qty;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected InventoryBatch() {
    }

    public InventoryBatch(Long skuId, Long locationId, Long batchId, int qty) {
        this.skuId = skuId;
        this.locationId = locationId;
        this.batchId = batchId;
        this.qty = qty;
        this.updatedAt = OffsetDateTime.now();
    }

    public void applyDelta(int delta) {
        this.qty += delta;
        if (this.qty < 0) {
            throw new IllegalStateException("批次库存不足");
        }
        this.updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public Long getSkuId() { return skuId; }
    public Long getLocationId() { return locationId; }
    public Long getBatchId() { return batchId; }
    public int getQty() { return qty; }
}
