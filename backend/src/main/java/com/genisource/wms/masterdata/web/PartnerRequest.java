package com.genisource.wms.masterdata.web;

import com.genisource.wms.masterdata.domain.Partner;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PartnerRequest(
        @NotBlank @Size(max = 64) String code,
        @NotBlank @Size(max = 128) String name,
        @NotNull Partner.Type type,
        @Size(max = 128) String contact) {
}
