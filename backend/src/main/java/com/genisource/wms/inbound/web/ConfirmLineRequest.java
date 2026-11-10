package com.genisource.wms.inbound.web;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Batch fields are optional: omitting them keeps the pre-V4 behaviour
 * (aggregate-only stock). expiryDate is ISO yyyy-MM-dd.
 */
public record ConfirmLineRequest(
        @NotBlank String skuCode,
        @NotBlank String locationCode,
        @Min(1) int qty,
        /** Generated once per row by the phone; replays with the same token are idempotent. */
        String clientToken,
        String batchNo,
        @Pattern(regexp = "^$|\\d{4}-\\d{2}-\\d{2}", message = "效期格式须为 yyyy-MM-dd")
        String expiryDate) {
}
