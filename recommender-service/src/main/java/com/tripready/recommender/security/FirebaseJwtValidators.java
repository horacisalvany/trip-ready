package com.tripready.recommender.security;

import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;

import java.util.List;

/**
 * Every Firebase project's ID tokens are signed by the same Google keys, so a token from any
 * other Firebase project passes issuer and signature checks. Without this, anyone with any
 * Firebase app could call this service.
 */
public final class FirebaseJwtValidators {

    private FirebaseJwtValidators() {
    }

    public static OAuth2TokenValidator<Jwt> audience(String expectedProjectId) {
        return new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(expectedProjectId));
    }
}
