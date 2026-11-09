package com.genisource.wms.masterdata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/** Supplier or customer — the counterparty on an inbound or outbound order. */
@Entity
@Table(name = "partner")
public class Partner {

    public enum Type {
        SUPPLIER,
        CUSTOMER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    private String contact;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected Partner() {
    }

    public Partner(String code, String name, Type type, String contact) {
        this.code = code;
        this.name = name;
        this.type = type;
        this.contact = contact;
        this.active = true;
        this.createdAt = OffsetDateTime.now();
    }

    public void update(String name, String contact, boolean active) {
        this.name = name;
        this.contact = contact;
        this.active = active;
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

    public Type getType() {
        return type;
    }

    public String getContact() {
        return contact;
    }

    public boolean isActive() {
        return active;
    }
}
