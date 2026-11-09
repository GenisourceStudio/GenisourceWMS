package com.genisource.wms.masterdata.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateLocationRequest(
        @NotBlank @Size(max = 64) String code,
        @Size(max = 64) String area,
        @Size(max = 255) String remark) {
}
