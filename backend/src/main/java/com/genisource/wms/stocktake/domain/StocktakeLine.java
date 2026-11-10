package com.genisource.wms.stocktake.domain;

import com.genisource.wms.masterdata.domain.Sku;
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
 * One SKU counted within a {@link StocktakeOrder}. {@code expectedQty} is the
 * snapshot of the location's inventory at create time; {@code actualQty} is the
 * counted quantity supplied at confirmation. The difference drives a single
 * {@code ADJUST} stock movement through {@code InventoryService}.
 */
@Entity
@Table(name = "stocktake_line")
public class StocktakeLine {

    public enum Status {
        PENDING,
        DONE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private StocktakeOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sku_id", nullable = false)
    private Sku sku;

    @Column(name = "expected_qty", nullable = false)
    private int expectedQty;

    /** Null until the line is confirmed; the column is nullable in V4. */
    @Column(name = "actual_qty")
    private Integer actualQty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    protected StocktakeLine() {
    }

    public StocktakeLine(Sku sku, int expectedQty) {
        this.sku = sku;
        this.expectedQty = expectedQty;
        this.status = Status.PENDING;
    }

    void attachTo(StocktakeOrder order) {
        this.order = order;
    }

    /** Marks the line done with the counted quantity. */
    public void confirm(int actualQty) {
        this.actualQty = actualQty;
        this.status = Status.DONE;
        this.confirmedAt = OffsetDateTime.now();
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

    public Integer getActualQty() {
        return actualQty;
    }

    public Status getStatus() {
        return status;
    }

    public OffsetDateTime getConfirmedAt() {
        return confirmedAt;
    }
}
