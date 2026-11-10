package com.genisource.wms.identity.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank @Size(max = 64) String displayName,
        @NotNull Boolean enabled,
        @NotBlank String roleCode) {
}
