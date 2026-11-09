package com.genisource.wms.masterdata.web;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateLocationRequest(
        @Size(max = 64) String area,
        @Size(max = 255) String remark,
        @NotNull Boolean isActive) {
}
