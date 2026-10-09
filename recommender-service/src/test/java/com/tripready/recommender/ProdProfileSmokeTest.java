package com.tripready.recommender;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * No assertions needed — this test's only job is to fail if the Spring context can't start
 * under the prod profile, e.g. because application-prod.yml dropped a required property. mvn
 * test never otherwise activates this profile, so without this test a regression here would
 * pass CI silently and only surface as a failed Cloud Run deploy.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "GEMINI_API_KEY=dummy-key-for-prod-profile-smoke-test")
@ActiveProfiles("prod")
class ProdProfileSmokeTest {

    @Test
    void contextLoadsWithTheProdProfileActive() {
    }
}
