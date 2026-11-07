package com.genisource.wms.masterdata.web;

import com.genisource.wms.masterdata.domain.Sku;

public record SkuResponse(
        Long id, String code, String name, String spec, String unit, boolean isActive) {

    public static SkuResponse from(Sku sku) {
        return new SkuResponse(
                sku.getId(), sku.getCode(), sku.getName(), sku.getSpec(), sku.getUnit(), sku.isActive());
    }
}
