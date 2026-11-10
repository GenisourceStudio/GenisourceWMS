package com.genisource.wms.identity.web;

import com.genisource.wms.identity.domain.AppUser;
import java.time.OffsetDateTime;
import java.util.List;

public record UserAdminResponse(
        Long id,
        String username,
        String displayName,
        boolean enabled,
        List<String> roles,
        OffsetDateTime createdAt) {

    public static UserAdminResponse from(AppUser user) {
        return new UserAdminResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.isEnabled(),
                List.copyOf(user.roleCodes()),
                user.getCreatedAt());
    }
}
