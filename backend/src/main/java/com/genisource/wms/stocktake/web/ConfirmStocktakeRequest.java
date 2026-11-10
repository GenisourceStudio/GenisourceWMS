package com.genisource.wms.stocktake.web;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ConfirmStocktakeRequest(
        /** Counted quantity; 0 is a valid result (everything missing). */
        @NotNull @Min(0) Integer actualQty) {
}
