package com.genisource.wms.inbound.domain;

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

@Entity
@Table(name = "inbound_order")
public class InboundOrder {

    public enum Status {
        DRAFT,
        PARTIAL,
        COMPLETED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique human-readable number, e.g. RK-20261107-0001. */
    @Column(name = "order_no", nullable = false, unique = true)
    private String orderNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_id", nullable = false)
    private com.genisource.wms.masterdata.domain.Partner partner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    private String remark;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InboundLine> lines = new ArrayList<>();

    protected InboundOrder() {
    }

    public InboundOrder(String placeholder, com.genisource.wms.masterdata.domain.Partner partner, String remark, Long createdBy) {
        this.orderNo = placeholder;
        this.partner = partner;
        this.remark = remark;
        this.createdBy = createdBy;
        this.status = Status.DRAFT;
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = this.createdAt;
    }

    /** Called after flush gives us an id; the placeholder exists only inside the create transaction. */
    public void assignOrderNo(String prefix) {
        this.orderNo = String.format("%s-%s-%04d", prefix,
                createdAt.atZoneSameInstant(java.time.ZoneId.of("Asia/Shanghai")).toLocalDate()
                        .toString().replace("-", ""),
                id);
    }

    public void addLine(InboundLine line) {
        lines.add(line);
        line.attachTo(this);
    }

    /**
     * Reconciles lines by SKU instead of clear()+add: with
     * {@code uk_inbound_line_sku (order_id, sku_id)}, deleting and re-inserting
     * the same SKU in one flush would violate the unique constraint. Existing
     * lines are updated in place; only genuinely new/removed SKUs are added or
     * removed.
     */
    public void replaceLines(List<InboundLine> newLines) {
        java.util.Map<Long, InboundLine> bySku = new java.util.HashMap<>();
        for (InboundLine line : lines) {
            bySku.put(line.getSku().getId(), line);
        }
        java.util.Set<Long> targetSkus = new java.util.HashSet<>();
        for (InboundLine line : newLines) {
            targetSkus.add(line.getSku().getId());
        }

        lines.removeIf(line -> !targetSkus.contains(line.getSku().getId()));
        for (InboundLine requested : newLines) {
            InboundLine existing = bySku.get(requested.getSku().getId());
            if (existing != null) {
                existing.updateExpectedQty(requested.getExpectedQty());
            } else {
                addLine(requested);
            }
        }
        this.updatedAt = OffsetDateTime.now();
    }

    public void setRemark(String remark) {
        this.remark = remark;
        this.updatedAt = OffsetDateTime.now();
    }

    /**
     * Status is derived from line progress — never set by hand (SDD §5.1).
     * Called inside the same transaction as a line confirmation.
     */
    public void recomputeStatus() {
        boolean anyDone = lines.stream().anyMatch(InboundLine::isDone);
        boolean allDone = !lines.isEmpty() && lines.stream().allMatch(InboundLine::isDone);

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
        this.updatedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public com.genisource.wms.masterdata.domain.Partner getPartner() {
        return partner;
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

    public List<InboundLine> getLines() {
        return List.copyOf(lines);
    }
}
