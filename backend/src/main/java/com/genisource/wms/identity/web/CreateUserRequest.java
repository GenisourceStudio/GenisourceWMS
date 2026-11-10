package com.genisource.wms.identity.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank @Size(min = 3, max = 64) String username,
        @NotBlank @Size(min = 6, max = 128) String password,
        @NotBlank @Size(max = 64) String displayName,
        @NotBlank String roleCode) {
}
