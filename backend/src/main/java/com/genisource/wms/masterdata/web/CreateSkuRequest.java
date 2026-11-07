package com.genisource.wms.masterdata.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Create payload. Code is chosen once by the warehouse and becomes the barcode. */
public record CreateSkuRequest(
        @NotBlank @Size(max = 64) String code,
        @NotBlank @Size(max = 128) String name,
        @Size(max = 128) String spec,
        @Size(max = 16) String unit) {
}
