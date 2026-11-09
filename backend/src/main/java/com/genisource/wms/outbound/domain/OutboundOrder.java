package com.genisource.wms.outbound.domain;

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
@Table(name = "outbound_order")
public class OutboundOrder {

    public enum Status {
        DRAFT,
        PARTIAL,
        COMPLETED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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
    private List<OutboundLine> lines = new ArrayList<>();

    protected OutboundOrder() {
    }

    public OutboundOrder(String placeholder, com.genisource.wms.masterdata.domain.Partner partner, String remark, Long createdBy) {
        this.orderNo = placeholder;
        this.partner = partner;
        this.remark = remark;
        this.createdBy = createdBy;
        this.status = Status.DRAFT;
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public void assignOrderNo() {
        this.orderNo = String.format("CK-%s-%04d",
                createdAt.atZoneSameInstant(java.time.ZoneId.of("Asia/Shanghai")).toLocalDate()
                        .toString().replace("-", ""),
                id);
    }

    public void addLine(OutboundLine line) {
        lines.add(line);
        line.attachTo(this);
    }

    public void recomputeStatus() {
        boolean anyDone = lines.stream().anyMatch(OutboundLine::isDone);
        boolean allDone = !lines.isEmpty() && lines.stream().allMatch(OutboundLine::isDone);

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

    public Long getId() { return id; }
    public String getOrderNo() { return orderNo; }
    public com.genisource.wms.masterdata.domain.Partner getPartner() { return partner; }
    public Status getStatus() { return status; }
    public String getRemark() { return remark; }
    public Long getCreatedBy() { return createdBy; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public List<OutboundLine> getLines() { return List.copyOf(lines); }
}
