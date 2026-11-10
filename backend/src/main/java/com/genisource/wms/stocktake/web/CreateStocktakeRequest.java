package com.genisource.wms.stocktake.web;

import jakarta.validation.constraints.NotNull;

public record CreateStocktakeRequest(
        @NotNull Long locationId,
        String remark) {
}
