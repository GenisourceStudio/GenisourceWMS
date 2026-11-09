package com.genisource.wms.masterdata.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdatePartnerRequest(
        @NotBlank @Size(max = 128) String name,
        @Size(max = 128) String contact,
        @NotNull Boolean isActive) {
}
