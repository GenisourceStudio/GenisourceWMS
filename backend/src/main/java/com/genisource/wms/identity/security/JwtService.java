package com.genisource.wms.identity.security;

import com.genisource.wms.identity.domain.AppUser;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

/**
 * Issues and decodes HS256 tokens using the Nimbus encoder/decoder that ship
 * with spring-security-oauth2-jose — no extra dependency beyond the resource
 * server starter.
 *
 * <p>Two token types share the same key and are told apart by the {@code typ}
 * claim, so a refresh token presented as a bearer token is rejected rather than
 * silently accepted.
 */
@Service
public class JwtService {

    public static final String CLAIM_TYPE = "typ";
    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final SecretKeySpec key;
    private final JwtEncoder encoder;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtService(
            @Value("${wms.security.jwt.secret}") String secret,
            @Value("${wms.security.jwt.access-ttl}") Duration accessTtl,
            @Value("${wms.security.jwt.refresh-ttl}") Duration refreshTtl) {
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            // A short HMAC key is trivially brute-forced; fail at startup instead
            // of shipping weak tokens.
            throw new IllegalStateException("wms.security.jwt.secret must be at least 32 bytes");
        }
        this.key = new SecretKeySpec(secretBytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(this.key));
        this.accessTtl = accessTtl;
        this.refreshTtl = refreshTtl;
    }

    public String issueAccessToken(AppUser user) {
        return issue(user, TYPE_ACCESS, accessTtl);
    }

    public String issueRefreshToken(AppUser user) {
        return issue(user, TYPE_REFRESH, refreshTtl);
    }

    private String issue(AppUser user, String type, Duration ttl) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(user.getUsername())
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .claim(CLAIM_TYPE, type)
                .claim("uid", user.getId())
                .claim("name", user.getDisplayName())
                .claim("perms", List.copyOf(user.permissionCodes()))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public JwtDecoder decoder() {
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    public Duration accessTtl() {
        return accessTtl;
    }

    public Duration refreshTtl() {
        return refreshTtl;
    }
}
