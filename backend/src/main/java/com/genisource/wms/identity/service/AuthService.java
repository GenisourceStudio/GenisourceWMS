package com.genisource.wms.identity.service;

import com.genisource.wms.identity.domain.AppUser;
import com.genisource.wms.identity.repository.UserRepository;
import com.genisource.wms.identity.security.JwtService;
import com.genisource.wms.identity.web.TokenResponse;
import com.genisource.wms.identity.web.UserSummary;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public TokenResponse login(String username, String password) {
        AppUser user = userRepository
                .findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        if (!user.isEnabled() || !passwordEncoder.matches(password, user.getPasswordHash())) {
            // Same exception for "unknown user", "disabled" and "wrong password":
            // the response must not reveal which accounts exist.
            throw new BadCredentialsException("Invalid username or password");
        }

        return new TokenResponse(
                jwtService.issueAccessToken(user),
                jwtService.issueRefreshToken(user),
                UserSummary.from(user));
    }

    /**
     * Exchanges a refresh token for a fresh pair. The user is re-read from the
     * database so a disabled account cannot keep refreshing its way in.
     */
    @Transactional(readOnly = true)
    public TokenResponse refresh(String refreshToken) {
        Jwt jwt;
        try {
            jwt = jwtService.decoder().decode(refreshToken);
        } catch (JwtException e) {
            throw new BadCredentialsException("Invalid refresh token");
        }

        if (!JwtService.TYPE_REFRESH.equals(jwt.getClaimAsString(JwtService.CLAIM_TYPE))) {
            throw new BadCredentialsException("Not a refresh token");
        }

        AppUser user = userRepository
                .findByUsername(jwt.getSubject())
                .filter(AppUser::isEnabled)
                .orElseThrow(() -> new BadCredentialsException("Account unavailable"));

        return new TokenResponse(
                jwtService.issueAccessToken(user),
                jwtService.issueRefreshToken(user),
                UserSummary.from(user));
    }

    @Transactional(readOnly = true)
    public UserSummary currentUser(String username) {
        return userRepository
                .findByUsername(username)
                .filter(AppUser::isEnabled)
                .map(UserSummary::from)
                .orElseThrow(() -> new BadCredentialsException("Account unavailable"));
    }
}
