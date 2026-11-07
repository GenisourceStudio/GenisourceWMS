package com.genisource.wms.identity.web;

import com.genisource.wms.identity.domain.AppUser;
import java.util.List;

/** The identity the SPA caches; permissions drive which screens it shows. */
public record UserSummary(Long id, String username, String displayName, List<String> permissions) {

    public static UserSummary from(AppUser user) {
        return new UserSummary(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                List.copyOf(user.permissionCodes()));
    }
}
