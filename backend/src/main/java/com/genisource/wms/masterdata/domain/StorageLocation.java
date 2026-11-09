package com.genisource.wms.masterdata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * Storage location. {@code code} is hierarchical-looking (A-01-02) but stored as
 * a flat string: the code is the only identity a scanner sees, and a tree would
 * add resolution rules the MVP does not need.
 */
@Entity
@Table(name = "location")
public class StorageLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    private String area;

    private String remark;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected StorageLocation() {
    }

    public StorageLocation(String code, String area, String remark) {
        this.code = code;
        this.area = area;
        this.remark = remark;
        this.active = true;
        this.createdAt = OffsetDateTime.now();
    }

    public void update(String area, String remark, boolean active) {
        this.area = area;
        this.remark = remark;
        this.active = active;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getArea() {
        return area;
    }

    public String getRemark() {
        return remark;
    }

    public boolean isActive() {
        return active;
    }
}
