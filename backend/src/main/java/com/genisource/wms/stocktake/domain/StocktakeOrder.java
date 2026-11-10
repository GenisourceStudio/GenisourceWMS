package com.genisource.wms.stocktake.domain;

import com.genisource.wms.masterdata.domain.StorageLocation;
import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A stocktake (盘点单) scoped to a single storage location. Its status is never
 * set by hand but derived from line progress via {@link #recomputeStatus()}.
 *
 * <p>The order number is a placeholder inside the create transaction; after
 * {@code saveAndFlush} assigns the identity, {@link #assignOrderNo(String)}
 * rewrites it to the human-readable {@code PD-YYYYMMDD-####} form. This mirrors
 * {@code InboundOrder.assignOrderNo} (SDD §5.5).
 */
@Entity
@Table(name = "stocktake_order")
public class StocktakeOrder {

    public enum Status {
        DRAFT,
        PARTIAL,
        COMPLETED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique human-readable number, e.g. PD-20261110-0001. */
    @Column(name = "order_no", nullable = false, unique = true)
    private String orderNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    private StorageLocation location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    private String remark;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StocktakeLine> lines = new ArrayList<>();

    protected StocktakeOrder() {
    }

    public StocktakeOrder(String placeholder, StorageLocation location, String remark, Long createdBy) {
        this.orderNo = placeholder;
        this.location = location;
        this.remark = remark;
        this.createdBy = createdBy;
        this.status = Status.DRAFT;
        this.createdAt = OffsetDateTime.now();
    }

    /** Called after flush gives us an id; the placeholder exists only inside the create transaction. */
    public void assignOrderNo(String prefix) {
        this.orderNo = String.format("%s-%s-%04d", prefix,
                createdAt.atZoneSameInstant(java.time.ZoneId.of("Asia/Shanghai")).toLocalDate()
                        .toString().replace("-", ""),
                id);
    }

    public void addLine(StocktakeLine line) {
        lines.add(line);
        line.attachTo(this);
    }

    /**
     * Status is derived from line progress — never set by hand (SDD §5.1).
     * Called inside the same transaction as a line confirmation.
     */
    public void recomputeStatus() {
        boolean anyDone = lines.stream().anyMatch(StocktakeLine::isDone);
        boolean allDone = !lines.isEmpty() && lines.stream().allMatch(StocktakeLine::isDone);

        if (allDone) {
            this.status = Status.COMPLETED;
            this.completedAt = OffsetDateTime.now();
        } else if (anyDone) {
            this.status = Status.PARTIAL;
            this.completedAt = null;
        } else {
            this.status = Status.DRAFT;
            this.completedAt = null;
        }
    }

    public Long getId() {
        return id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public StorageLocation getLocation() {
        return location;
    }

    public Status getStatus() {
        return status;
    }

    public String getRemark() {
        return remark;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }

    public List<StocktakeLine> getLines() {
        return List.copyOf(lines);
    }
}
