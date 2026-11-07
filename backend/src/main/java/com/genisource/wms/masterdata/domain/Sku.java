package com.genisource.wms.masterdata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * Stock keeping unit. {@code code} doubles as the barcode payload, so it is the
 * only identity a scanner ever sees — it can never change after creation.
 *
 * <p>SKUs are never physically deleted; {@code isActive=false} retires one while
 * keeping historical documents readable.
 */
@Entity
@Table(name = "sku")
public class Sku {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    private String spec;

    private String unit;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Sku() {
    }

    public Sku(String code, String name, String spec, String unit) {
        this.code = code;
        this.name = name;
        this.spec = spec;
        this.unit = unit;
        this.active = true;
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = this.createdAt;
    }

    /** Code is immutable: it is the barcode content and may be printed on stock. */
    public void update(String name, String spec, String unit) {
        this.name = name;
        this.spec = spec;
        this.unit = unit;
        this.updatedAt = OffsetDateTime.now();
    }

    public void setActive(boolean active) {
        this.active = active;
        this.updatedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getSpec() {
        return spec;
    }

    public String getUnit() {
        return unit;
    }

    public boolean isActive() {
        return active;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
