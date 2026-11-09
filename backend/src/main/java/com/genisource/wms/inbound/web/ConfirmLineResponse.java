package com.genisource.wms.inbound.web;

public record ConfirmLineResponse(
        Long lineId,
        String lineStatus,
        int qtyAfter,
        String orderStatus) {
}
