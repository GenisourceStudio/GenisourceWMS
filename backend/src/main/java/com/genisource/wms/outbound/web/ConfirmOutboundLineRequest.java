package com.genisource.wms.outbound.web;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ConfirmOutboundLineRequest(
        @NotBlank String skuCode,
        @NotBlank String locationCode,
        @Min(1) int qty,
        String clientToken,
        /** Optional: must match the FEFO suggestion for the scanned location. */
        String batchNo) {
}
