package com.genisource.wms.inventory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * The single source of truth for "how many of a SKU sit in a location".
 * No reserved / frozen / in-transit layer (PRD).
 *
 * <p>Written only by InventoryService.recordStockChange, always inside the same
 * transaction as the ledger entry and the audit log.
 */
@Entity
@Table(name = "inventory")
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sku_id", nullable = false)
    private Long skuId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(nullable = false)
    private int qty;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Inventory() {
    }

    public Inventory(Long skuId, Long locationId, int qty) {
        this.skuId = skuId;
        this.locationId = locationId;
        this.qty = qty;
        this.updatedAt = OffsetDateTime.now();
    }

    public void applyDelta(int delta) {
        this.qty += delta;
        if (this.qty < 0) {
            // Belt and braces: the DB CHECK constraint is the final guard, but
            // failing here gives a clear message instead of a constraint error.
            throw new IllegalStateException("库存不足");
        }
        this.updatedAt = OffsetDateTime.now();
    }

    public Long getSkuId() {
        return skuId;
    }

    public Long getId() {
        return id;
    }

    public Long getLocationId() {
        return locationId;
    }

    public int getQty() {
        return qty;
    }
}
