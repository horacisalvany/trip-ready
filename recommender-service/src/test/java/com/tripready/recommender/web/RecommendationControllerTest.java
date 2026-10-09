package com.tripready.recommender.web;

import com.tripready.recommender.dto.RecommendationRequest;
import com.tripready.recommender.dto.Suggestion;
import com.tripready.recommender.dto.SuggestionList;
import com.tripready.recommender.security.SecurityConfig;
import com.tripready.recommender.service.QuotaExceededException;
import com.tripready.recommender.service.RecommendationService;
import com.tripready.recommender.service.RecommendationUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RecommendationController.class)
@Import(SecurityConfig.class)
class RecommendationControllerTest {

    private static final String VALID_BODY = """
            {
              "listTitle": "Japan trip",
              "tripNote": "2 weeks, November",
              "sections": [
                { "name": "Clothing", "items": ["socks"] }
              ]
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RecommendationService recommendationService;

    // SecurityConfig's filter chain configures oauth2ResourceServer().jwt(), and
    // OAuth2ResourceServerConfigurer resolves a JwtDecoder bean eagerly while building the
    // SecurityFilterChain — before any request is served, not lazily per-request. Without a
    // JwtDecoder bean in this slice's context, the whole ApplicationContext fails to start, even
    // for a test that never sends a token. This mock exists purely to satisfy that bean lookup;
    // its methods are never called, since jwt() (below) injects an authenticated principal
    // directly and a missing Authorization header never reaches decoding either. Importing
    // JwtDecoderConfig instead would satisfy the same lookup but hit Google's real OIDC discovery
    // endpoint on every test run — exactly what this mock avoids.
    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void rejectsARequestWithNoToken() throws Exception {
        mockMvc.perform(post("/api/recommendations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsSuggestionsForAnAuthenticatedRequest() throws Exception {
        given(recommendationService.recommend(any(RecommendationRequest.class), anyString()))
                .willReturn(new SuggestionList(List.of(new Suggestion("Rain jacket", "Clothing", "November is wet"))));

        mockMvc.perform(post("/api/recommendations")
                        .with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions[0].name").value("Rain jacket"))
                .andExpect(jsonPath("$.suggestions[0].section").value("Clothing"));
    }

    @Test
    void rejectsATripNoteOverTwoHundredCharacters() throws Exception {
        String body = """
                { "tripNote": "%s", "sections": [] }
                """.formatted("a".repeat(201));

        mockMvc.perform(post("/api/recommendations")
                        .with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void mapsQuotaExceededToTooManyRequests() throws Exception {
        given(recommendationService.recommend(any(RecommendationRequest.class), anyString()))
                .willThrow(new QuotaExceededException());

        mockMvc.perform(post("/api/recommendations")
                        .with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void mapsAModelFailureToBadGateway() throws Exception {
        given(recommendationService.recommend(any(RecommendationRequest.class), anyString()))
                .willThrow(new RecommendationUnavailableException(new RuntimeException("boom")));

        mockMvc.perform(post("/api/recommendations")
                        .with(jwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isBadGateway());
    }

    @Test
    void allowsCrossOriginPreflightFromTheConfiguredOrigin() throws Exception {
        mockMvc.perform(options("/api/recommendations")
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
    }

    @Test
    void rejectsCrossOriginPreflightFromAnUnlistedOrigin() throws Exception {
        mockMvc.perform(options("/api/recommendations")
                        .header("Origin", "https://evil.example.com")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}
