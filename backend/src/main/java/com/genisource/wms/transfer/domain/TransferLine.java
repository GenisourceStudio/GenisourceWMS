package com.genisource.wms.transfer.domain;

import com.genisource.wms.masterdata.domain.Sku;
import com.genisource.wms.masterdata.domain.StorageLocation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * 调拨单行：把某 SKU 从 fromLocation 搬到 toLocation qty 件。
 *
 * <p>{@code confirm_token} 是幂等键：同一 token 重放返回首次结果、不重复记账。
 * V4 迁移里该表没有 confirmed_by 列，因此实体不映射该字段（ddl-auto=validate）。
 */
@Entity
@Table(name = "transfer_line")
public class TransferLine {

    public enum Status {
        PENDING,
        DONE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private TransferOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sku_id", nullable = false)
    private Sku sku;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_location_id", nullable = false)
    private StorageLocation fromLocation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_location_id", nullable = false)
    private StorageLocation toLocation;

    @Column(nullable = false)
    private int qty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    /** Idempotency key: a retried request with the same token replays the first result. */
    @Column(name = "confirm_token")
    private String confirmToken;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    protected TransferLine() {
    }

    public TransferLine(Sku sku, StorageLocation fromLocation, StorageLocation toLocation, int qty) {
        this.sku = sku;
        this.fromLocation = fromLocation;
        this.toLocation = toLocation;
        this.qty = qty;
        this.status = Status.PENDING;
    }

    void attachTo(TransferOrder order) {
        this.order = order;
    }

    /** Returns false when the line was already done — the caller treats that as a conflict. */
    public boolean confirm(String token) {
        if (status == Status.DONE) {
            return false;
        }
        this.status = Status.DONE;
        this.confirmToken = token;
        this.confirmedAt = OffsetDateTime.now();
        return true;
    }

    public boolean isDone() {
        return status == Status.DONE;
    }

    public Long getId() {
        return id;
    }

    public TransferOrder getOrder() {
        return order;
    }

    public Sku getSku() {
        return sku;
    }

    public StorageLocation getFromLocation() {
        return fromLocation;
    }

    public StorageLocation getToLocation() {
        return toLocation;
    }

    public int getQty() {
        return qty;
    }

    public Status getStatus() {
        return status;
    }

    public String getConfirmToken() {
        return confirmToken;
    }

    public OffsetDateTime getConfirmedAt() {
        return confirmedAt;
    }
}
