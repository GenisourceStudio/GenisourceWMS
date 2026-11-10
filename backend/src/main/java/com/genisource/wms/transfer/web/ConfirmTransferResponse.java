package com.genisource.wms.transfer.web;

public record ConfirmTransferResponse(
        Long lineId,
        String lineStatus,
        String orderStatus,
        int qtyAfterFrom,
        int qtyAfterTo) {
}
