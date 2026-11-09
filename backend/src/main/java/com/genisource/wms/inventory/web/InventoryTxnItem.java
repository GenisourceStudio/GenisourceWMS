package com.genisource.wms.inventory.web;

import java.time.OffsetDateTime;

public record InventoryTxnItem(
        Long id,
        OffsetDateTime occurredAt,
        String type,
        String skuCode,
        String locationCode,
        int qtyDelta,
        int qtyAfter,
        String orderNo,
        Long lineId,
        String operatorName) {
}
