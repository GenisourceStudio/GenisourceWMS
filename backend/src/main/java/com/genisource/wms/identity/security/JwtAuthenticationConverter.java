package com.genisource.wms.identity.security;

import com.genisource.wms.identity.domain.AppUser;
import com.genisource.wms.identity.repository.UserRepository;
import java.util.List;
import java.util.Set;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Component;

/**
 * Turns a verified JWT into an authentication by re-reading the user from the
 * database on every request.
 *
 * <p>Doing it per request (rather than trusting the {@code perms} claim) is what
 * makes revocation immediate: disabling an account or removing a permission
 * takes effect on the next call instead of at token expiry. The claim is kept
 * only as a debugging aid in the token payload.
 */
@Component
public class JwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserRepository userRepository;

    public JwtAuthenticationConverter(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        if (!JwtService.TYPE_ACCESS.equals(jwt.getClaimAsString(JwtService.CLAIM_TYPE))) {
            // A refresh token must never work as a bearer credential.
            throw new InvalidBearerTokenException("Refresh token cannot be used as an access token");
        }

        AppUser user = userRepository
                .findByUsername(jwt.getSubject())
                .orElseThrow(() -> new InvalidBearerTokenException("Unknown user"));

        if (!user.isEnabled()) {
            throw new InvalidBearerTokenException("Account disabled");
        }

        Set<String> permissions = user.permissionCodes();
        List<GrantedAuthority> authorities = permissions.stream()
                .<GrantedAuthority>map(SimpleGrantedAuthority::new)
                .toList();

        UserPrincipal principal = new UserPrincipal(user.getId(), user.getUsername(), user.getDisplayName(), permissions);
        return UsernamePasswordAuthenticationToken.authenticated(principal, jwt.getTokenValue(), authorities);
    }

    /**
     * Authentication principal. Implements {@link Principal} so
     * {@code Authentication.getName()} returns the username rather than the
     * record's toString().
     */
    public record UserPrincipal(Long id, String username, String displayName, Set<String> permissions)
            implements java.security.Principal {

        @Override
        public String getName() {
            return username;
        }
    }
}
