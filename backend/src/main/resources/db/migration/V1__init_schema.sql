-- GenisourceWMS initial schema.
-- Mirrors docs/SYSTEM_DESIGN.md §4. Flyway owns the schema; Hibernate runs
-- with ddl-auto=validate, so any entity/schema drift fails fast at startup.
--
-- Core invariant: inventory.qty is the current state, inventory_txn is the
-- append-only event chain. Both are written in the same @Transactional method
-- (see docs/SYSTEM_DESIGN.md §5.2). qty is never allowed to go negative.

-- ----------------------------------------------------------------- masterdata
CREATE TABLE sku (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    spec        VARCHAR(128),
    unit        VARCHAR(16),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_sku_code UNIQUE (code)
);

-- Hierarchical-looking string (A-01-02). No tree structure: the code is the
-- only identity, which keeps scanning and confirmation unambiguous.
CREATE TABLE location (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64) NOT NULL,
    area        VARCHAR(64),
    remark      VARCHAR(255),
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_location_code UNIQUE (code)
);

CREATE TABLE partner (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    type        VARCHAR(16)  NOT NULL,
    contact     VARCHAR(128),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_partner_code UNIQUE (code),
    CONSTRAINT ck_partner_type CHECK (type IN ('SUPPLIER', 'CUSTOMER'))
);

-- --------------------------------------------------------------------- orders
CREATE TABLE inbound_order (
    id           BIGSERIAL PRIMARY KEY,
    order_no     VARCHAR(32) NOT NULL,
    partner_id   BIGINT      NOT NULL REFERENCES partner (id),
    status       VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    remark       VARCHAR(255),
    created_by   BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_inbound_order_no UNIQUE (order_no),
    CONSTRAINT ck_inbound_order_status CHECK (status IN ('DRAFT', 'PARTIAL', 'COMPLETED'))
);

CREATE TABLE inbound_line (
    id            BIGSERIAL PRIMARY KEY,
    order_id      BIGINT      NOT NULL REFERENCES inbound_order (id) ON DELETE CASCADE,
    sku_id        BIGINT      NOT NULL REFERENCES sku (id),
    expected_qty  INTEGER     NOT NULL,
    confirmed_qty INTEGER     NOT NULL DEFAULT 0,
    location_id   BIGINT      REFERENCES location (id),
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    confirm_token VARCHAR(64),
    confirmed_by  BIGINT,
    confirmed_at  TIMESTAMPTZ,
    CONSTRAINT uk_inbound_line_sku UNIQUE (order_id, sku_id),
    CONSTRAINT ck_inbound_line_qty CHECK (expected_qty > 0 AND confirmed_qty >= 0),
    CONSTRAINT ck_inbound_line_status CHECK (status IN ('PENDING', 'DONE'))
);

CREATE TABLE outbound_order (
    id           BIGSERIAL PRIMARY KEY,
    order_no     VARCHAR(32) NOT NULL,
    partner_id   BIGINT      NOT NULL REFERENCES partner (id),
    status       VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    remark       VARCHAR(255),
    created_by   BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_outbound_order_no UNIQUE (order_no),
    CONSTRAINT ck_outbound_order_status CHECK (status IN ('DRAFT', 'PARTIAL', 'COMPLETED'))
);

CREATE TABLE outbound_line (
    id            BIGSERIAL PRIMARY KEY,
    order_id      BIGINT      NOT NULL REFERENCES outbound_order (id) ON DELETE CASCADE,
    sku_id        BIGINT      NOT NULL REFERENCES sku (id),
    expected_qty  INTEGER     NOT NULL,
    confirmed_qty INTEGER     NOT NULL DEFAULT 0,
    location_id   BIGINT      REFERENCES location (id),
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    confirm_token VARCHAR(64),
    confirmed_by  BIGINT,
    confirmed_at  TIMESTAMPTZ,
    CONSTRAINT uk_outbound_line_sku UNIQUE (order_id, sku_id),
    CONSTRAINT ck_outbound_line_qty CHECK (expected_qty > 0 AND confirmed_qty >= 0),
    CONSTRAINT ck_outbound_line_status CHECK (status IN ('PENDING', 'DONE'))
);

-- --------------------------------------------------------------- inventory
-- Single source of truth for "how many of a SKU sit in a location". There is
-- no reserved / in-transit / frozen layer (PRD §明确不做).
CREATE TABLE inventory (
    id          BIGSERIAL PRIMARY KEY,
    sku_id      BIGINT      NOT NULL REFERENCES sku (id),
    location_id BIGINT      NOT NULL REFERENCES location (id),
    qty         INTEGER     NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_inventory_sku_location UNIQUE (sku_id, location_id),
    CONSTRAINT ck_inventory_qty CHECK (qty >= 0)
);

-- Append-only ledger. Never UPDATE or DELETE rows in this table.
CREATE TABLE inventory_txn (
    id          BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    type        VARCHAR(16) NOT NULL,
    sku_id      BIGINT      NOT NULL REFERENCES sku (id),
    location_id BIGINT      NOT NULL REFERENCES location (id),
    qty_delta   INTEGER     NOT NULL,
    qty_after   INTEGER     NOT NULL,
    order_type  VARCHAR(16) NOT NULL,
    order_id    BIGINT      NOT NULL,
    order_no    VARCHAR(32) NOT NULL,
    line_id     BIGINT      NOT NULL,
    operator_id BIGINT,
    remark      VARCHAR(255),
    CONSTRAINT ck_inventory_txn_type CHECK (type IN ('INBOUND', 'OUTBOUND')),
    CONSTRAINT ck_inventory_txn_delta CHECK (qty_delta <> 0 AND qty_after >= 0)
);

CREATE INDEX idx_inventory_txn_sku_time ON inventory_txn (sku_id, occurred_at DESC);
CREATE INDEX idx_inventory_txn_order ON inventory_txn (order_id, order_type);

-- --------------------------------------------------------------- identity
CREATE TABLE app_user (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(64)  NOT NULL,
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_app_user_username UNIQUE (username)
);

CREATE TABLE role (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(32) NOT NULL,
    name        VARCHAR(64) NOT NULL,
    CONSTRAINT uk_role_code UNIQUE (code)
);

CREATE TABLE permission (
    id   BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    CONSTRAINT uk_permission_code UNIQUE (code)
);

CREATE TABLE user_role (
    user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES role (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permission (
    role_id       BIGINT NOT NULL REFERENCES role (id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permission (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Audit trail for every write. detail_json holds before/after snapshots and
-- the raw scanned input so a mis-scan can be diagnosed after the fact.
CREATE TABLE operation_log (
    id          BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id    BIGINT,
    actor_name  VARCHAR(64) NOT NULL,
    action      VARCHAR(64) NOT NULL,
    target_type VARCHAR(32),
    target_id   BIGINT,
    detail_json JSONB,
    ip          VARCHAR(64)
);

CREATE INDEX idx_operation_log_time ON operation_log (occurred_at DESC);
CREATE INDEX idx_operation_log_detail ON operation_log USING GIN (detail_json);
