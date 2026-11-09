package com.genisource.wms.inventory.web;

import java.time.OffsetDateTime;

public record InventoryItem(
        Long skuId,
        String skuCode,
        String skuName,
        Long locationId,
        String locationCode,
        int qty,
        OffsetDateTime updatedAt) {
}
