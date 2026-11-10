package com.genisource.wms.transfer.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * 库位间调拨单。状态由行进度派生（DRAFT / PARTIAL / COMPLETED），不手工设置。
 *
 * <p>单号 {@code DB-YYYYMMDD-####}：事务内先写入占位串，saveAndFlush 拿到自增
 * id 后再赋最终值（占位串只存在于建单事务内，见 InboundOrder）。V4 迁移里该表
 * 没有 updated_at 列，因此实体不映射该字段（ddl-auto=validate）。
 */
@Entity
@Table(name = "transfer_order")
public class TransferOrder {

    public enum Status {
        DRAFT,
        PARTIAL,
        COMPLETED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-readable number, e.g. DB-20261110-0001. Placeholder until flush. */
    @Column(name = "order_no", nullable = false, unique = true)
    private String orderNo;

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
    private List<TransferLine> lines = new ArrayList<>();

    protected TransferOrder() {
    }

    public TransferOrder(String placeholder, String remark, Long createdBy) {
        this.orderNo = placeholder;
        this.remark = remark;
        this.createdBy = createdBy;
        this.status = Status.DRAFT;
        this.createdAt = OffsetDateTime.now();
    }

    /** Called after saveAndFlush assigns the id; the placeholder lives only inside the create tx. */
    public void assignOrderNo(String prefix) {
        this.orderNo = String.format("%s-%s-%04d", prefix,
                createdAt.atZoneSameInstant(ZoneId.of("Asia/Shanghai")).toLocalDate()
                        .toString().replace("-", ""),
                id);
    }

    public void addLine(TransferLine line) {
        lines.add(line);
        line.attachTo(this);
    }

    /** Status is derived from line progress, never set by hand. */
    public void recomputeStatus() {
        boolean anyDone = lines.stream().anyMatch(TransferLine::isDone);
        boolean allDone = !lines.isEmpty() && lines.stream().allMatch(TransferLine::isDone);

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

    public List<TransferLine> getLines() {
        return List.copyOf(lines);
    }
}
