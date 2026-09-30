package com.tripready.recommender.service;

import com.tripready.recommender.dto.RecommendationRequest;
import com.tripready.recommender.dto.SectionDto;
import com.tripready.recommender.dto.Suggestion;
import com.tripready.recommender.dto.SuggestionList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;

import java.time.Clock;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecommendationServiceTest {

    private ChatClient.Builder builder;
    private ChatClient chatClient;
    private ChatClient.ChatClientRequestSpec requestSpec;
    private ChatClient.CallResponseSpec callResponseSpec;
    private QuotaService quotaService;

    @BeforeEach
    void setUp() {
        builder = mock(ChatClient.Builder.class);
        chatClient = mock(ChatClient.class);
        requestSpec = mock(ChatClient.ChatClientRequestSpec.class);
        callResponseSpec = mock(ChatClient.CallResponseSpec.class);

        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(requestSpec);
        when(requestSpec.system(anyString())).thenReturn(requestSpec);
        when(requestSpec.user(anyString())).thenReturn(requestSpec);
        when(requestSpec.call()).thenReturn(callResponseSpec);

        quotaService = new QuotaService(10, Clock.systemUTC());
    }

    private static RecommendationRequest aRequest() {
        return new RecommendationRequest(
                "Japan trip", null, List.of(new SectionDto("Documents", List.of("Passport"))));
    }

    @Test
    void returnsFilteredSuggestionsFromTheModel() {
        when(callResponseSpec.entity(SuggestionList.class)).thenReturn(new SuggestionList(List.of(
                new Suggestion("Passport", "Documents", "Already listed, must be filtered"),
                new Suggestion("Rain jacket", "Clothing", "November is wet"))));

        RecommendationService service = new RecommendationService(builder, quotaService);

        SuggestionList result = service.recommend(aRequest(), "user-1");

        assertThat(result.suggestions()).containsExactly(new Suggestion("Rain jacket", "Clothing", "November is wet"));
    }

    @Test
    void neverCallsTheModelOnceTheDailyQuotaIsSpent() {
        QuotaService exhausted = new QuotaService(0, Clock.systemUTC());
        RecommendationService service = new RecommendationService(builder, exhausted);

        assertThatThrownBy(() -> service.recommend(aRequest(), "user-1"))
                .isInstanceOf(QuotaExceededException.class);

        verify(chatClient, never()).prompt();
    }

    @Test
    void wrapsAModelFailureAsRecommendationUnavailable() {
        when(callResponseSpec.entity(SuggestionList.class)).thenThrow(new RuntimeException("boom"));

        RecommendationService service = new RecommendationService(builder, quotaService);

        assertThatThrownBy(() -> service.recommend(aRequest(), "user-1"))
                .isInstanceOf(RecommendationUnavailableException.class);
    }
}
