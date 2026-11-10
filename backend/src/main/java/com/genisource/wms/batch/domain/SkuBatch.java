package com.genisource.wms.batch.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** A batch of a SKU, identified by batchNo, optionally with an expiry date. */
@Entity
@Table(name = "sku_batch")
public class SkuBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sku_id", nullable = false)
    private Long skuId;

    @Column(name = "batch_no", nullable = false)
    private String batchNo;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected SkuBatch() {
    }

    public SkuBatch(Long skuId, String batchNo, LocalDate expiryDate) {
        this.skuId = skuId;
        this.batchNo = batchNo;
        this.expiryDate = expiryDate;
        this.createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public Long getSkuId() { return skuId; }
    public String getBatchNo() { return batchNo; }
    public LocalDate getExpiryDate() { return expiryDate; }
}
