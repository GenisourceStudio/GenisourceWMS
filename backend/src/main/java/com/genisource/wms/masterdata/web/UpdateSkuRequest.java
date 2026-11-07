package com.genisource.wms.masterdata.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Edit payload. The code is deliberately absent — it is the barcode. */
public record UpdateSkuRequest(
        @NotBlank @Size(max = 128) String name,
        @Size(max = 128) String spec,
        @Size(max = 16) String unit,
        @NotNull Boolean isActive) {
}
