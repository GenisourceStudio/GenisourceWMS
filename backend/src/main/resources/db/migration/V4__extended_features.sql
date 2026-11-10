-- A 类扩展：批次 / 盘点 / 调拨（PRD 2026-11-10 扩展范围）。
--
-- 设计取舍：inventory 聚合表仍按 (sku, location) 保存当前态，保护已验证的
-- 核心链路；新增 inventory_batch 保存 (sku, location, batch) 明细真值，
-- 两者在同一事务内同步。批次是可选的：不登记批次的出入库完全走原路径。

-- ------------------------------------------------------------------ batches
CREATE TABLE sku_batch (
    id          BIGSERIAL PRIMARY KEY,
    sku_id      BIGINT      NOT NULL REFERENCES sku (id),
    batch_no    VARCHAR(64) NOT NULL,
    expiry_date DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_sku_batch UNIQUE (sku_id, batch_no)
);

CREATE TABLE inventory_batch (
    id          BIGSERIAL PRIMARY KEY,
    sku_id      BIGINT      NOT NULL REFERENCES sku (id),
    location_id BIGINT      NOT NULL REFERENCES location (id),
    batch_id    BIGINT      NOT NULL REFERENCES sku_batch (id),
    qty         INTEGER     NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_inventory_batch UNIQUE (sku_id, location_id, batch_id),
    CONSTRAINT ck_inventory_batch_qty CHECK (qty >= 0)
);

-- Ledger rows may carry a batch; legacy rows keep NULL.
ALTER TABLE inventory_txn ADD COLUMN batch_id BIGINT REFERENCES sku_batch (id);
ALTER TABLE inventory_txn DROP CONSTRAINT ck_inventory_txn_type;
ALTER TABLE inventory_txn ADD CONSTRAINT ck_inventory_txn_type
    CHECK (type IN ('INBOUND', 'OUTBOUND', 'ADJUST', 'TRANSFER_OUT', 'TRANSFER_IN'));

CREATE INDEX idx_inventory_batch_sku ON inventory_batch (sku_id, location_id);
CREATE INDEX idx_sku_batch_expiry ON sku_batch (sku_id, expiry_date);

-- ---------------------------------------------------------------- stocktake
CREATE TABLE stocktake_order (
    id           BIGSERIAL PRIMARY KEY,
    order_no     VARCHAR(32) NOT NULL,
    location_id  BIGINT      NOT NULL REFERENCES location (id),
    status       VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    remark       VARCHAR(255),
    created_by   BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_stocktake_order_no UNIQUE (order_no),
    CONSTRAINT ck_stocktake_status CHECK (status IN ('DRAFT', 'PARTIAL', 'COMPLETED'))
);

CREATE TABLE stocktake_line (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT      NOT NULL REFERENCES stocktake_order (id) ON DELETE CASCADE,
    sku_id       BIGINT      NOT NULL REFERENCES sku (id),
    expected_qty INTEGER     NOT NULL,
    actual_qty   INTEGER,
    status       VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT uk_stocktake_line UNIQUE (order_id, sku_id),
    CONSTRAINT ck_stocktake_line_status CHECK (status IN ('PENDING', 'DONE'))
);

-- ----------------------------------------------------------------- transfers
CREATE TABLE transfer_order (
    id           BIGSERIAL PRIMARY KEY,
    order_no     VARCHAR(32) NOT NULL,
    status       VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    remark       VARCHAR(255),
    created_by   BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uk_transfer_order_no UNIQUE (order_no),
    CONSTRAINT ck_transfer_status CHECK (status IN ('DRAFT', 'PARTIAL', 'COMPLETED'))
);

CREATE TABLE transfer_line (
    id                BIGSERIAL PRIMARY KEY,
    order_id          BIGINT      NOT NULL REFERENCES transfer_order (id) ON DELETE CASCADE,
    sku_id            BIGINT      NOT NULL REFERENCES sku (id),
    from_location_id  BIGINT      NOT NULL REFERENCES location (id),
    to_location_id    BIGINT      NOT NULL REFERENCES location (id),
    qty               INTEGER     NOT NULL,
    status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    confirm_token     VARCHAR(64),
    confirmed_at      TIMESTAMPTZ,
    CONSTRAINT ck_transfer_qty CHECK (qty > 0),
    CONSTRAINT ck_transfer_line_status CHECK (status IN ('PENDING', 'DONE'))
);
