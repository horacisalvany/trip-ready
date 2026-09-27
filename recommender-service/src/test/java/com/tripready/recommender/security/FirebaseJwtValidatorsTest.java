package com.tripready.recommender.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FirebaseJwtValidatorsTest {

    private static final String PROJECT_ID = "ready4trip-5d3f6";

    @Test
    void acceptsATokenWhoseAudienceIsTheProjectId() {
        Jwt jwt = jwtWithAudience(PROJECT_ID);

        OAuth2TokenValidatorResult result = FirebaseJwtValidators.audience(PROJECT_ID).validate(jwt);

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void rejectsATokenFromAnotherFirebaseProject() {
        Jwt jwt = jwtWithAudience("some-other-project");

        OAuth2TokenValidatorResult result = FirebaseJwtValidators.audience(PROJECT_ID).validate(jwt);

        assertThat(result.hasErrors()).isTrue();
    }

    private static Jwt jwtWithAudience(String audience) {
        // A real NimbusJwtDecoder normalizes "aud" to a List<String> via MappedJwtClaimSetConverter,
        // regardless of whether the token's raw JSON has a single string or an array. Building the
        // claim as a List here matches what FirebaseJwtValidators.audience() actually receives from
        // a decoded token — building it as a raw String would not, and would fail at runtime with a
        // ClassCastException inside JwtClaimValidator, not a false test result.
        Instant now = Instant.now();
        return Jwt.withTokenValue("token-value")
                .header("alg", "RS256")
                .claim("aud", List.of(audience))
                .claim("sub", "user-1")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build();
    }
}
