package com.genisource.wms.inbound.web;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ConfirmLineRequest(
        @NotBlank String skuCode,
        @NotBlank String locationCode,
        @Min(1) int qty,
        /** Generated once per row by the phone; replays with the same token are idempotent. */
        String clientToken) {
}
