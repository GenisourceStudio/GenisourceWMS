package com.genisource.wms.stocktake.web;

/** Result of confirming one stocktake line. */
public record ConfirmStocktakeResponse(
        Long lineId,
        String status,
        int delta,
        int qtyAfter,
        String orderStatus) {
}
