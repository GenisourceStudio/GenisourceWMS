package com.genisource.wms.inbound.domain;

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

@Entity
@Table(name = "inbound_line")
public class InboundLine {

    public enum Status {
        PENDING,
        DONE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private InboundOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sku_id", nullable = false)
    private Sku sku;

    @Column(name = "expected_qty", nullable = false)
    private int expectedQty;

    @Column(name = "confirmed_qty", nullable = false)
    private int confirmedQty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id")
    private StorageLocation location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    /** Idempotency key: a retried request with the same token replays the first result. */
    @Column(name = "confirm_token")
    private String confirmToken;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    protected InboundLine() {
    }

    public InboundLine(Sku sku, int expectedQty) {
        this.sku = sku;
        this.expectedQty = expectedQty;
        this.confirmedQty = 0;
        this.status = Status.PENDING;
    }

    void attachTo(InboundOrder order) {
        this.order = order;
    }

    /** Returns false when the line was already done — the caller treats that as a conflict. */
    public boolean confirm(StorageLocation location, int qty, String token, Long operatorId) {
        if (status == Status.DONE) {
            return false;
        }
        this.location = location;
        this.confirmedQty = qty;
        this.status = Status.DONE;
        this.confirmToken = token;
        this.confirmedBy = operatorId;
        this.confirmedAt = OffsetDateTime.now();
        return true;
    }

    public boolean isDone() {
        return status == Status.DONE;
    }

    public Long getId() {
        return id;
    }

    public Sku getSku() {
        return sku;
    }

    public int getExpectedQty() {
        return expectedQty;
    }

    public int getConfirmedQty() {
        return confirmedQty;
    }

    public StorageLocation getLocation() {
        return location;
    }

    public Status getStatus() {
        return status;
    }

    public String getConfirmToken() {
        return confirmToken;
    }

    public Long getConfirmedBy() {
        return confirmedBy;
    }
}
