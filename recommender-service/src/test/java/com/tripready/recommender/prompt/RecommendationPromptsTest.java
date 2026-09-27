package com.tripready.recommender.prompt;

import com.tripready.recommender.dto.RecommendationRequest;
import com.tripready.recommender.dto.SectionDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationPromptsTest {

    @Test
    void theSystemPromptNeverContainsTheNote() {
        String note = "a very specific, unmistakable trip note";
        RecommendationRequest request = new RecommendationRequest("Trip", note, List.of());

        RecommendationPrompts.userMessage(request); // building the user message must not mutate SYSTEM

        assertThat(RecommendationPrompts.SYSTEM).doesNotContain(note);
    }

    @Test
    void theUserMessageContainsTheNoteWhenPresent() {
        RecommendationRequest request = new RecommendationRequest("Japan trip", "2 weeks, November", List.of());

        String message = RecommendationPrompts.userMessage(request);

        assertThat(message).contains("Japan trip").contains("2 weeks, November");
    }

    @Test
    void theUserMessageNamesAnAbsentTitleAndNoteExplicitly() {
        RecommendationRequest request = new RecommendationRequest(null, null, List.of());

        String message = RecommendationPrompts.userMessage(request);

        assertThat(message).contains("Untitled trip").contains("(none)");
    }

    @Test
    void theUserMessageListsEachSectionAndItsItems() {
        RecommendationRequest request = new RecommendationRequest(
                "Trip", null, List.of(
                        new SectionDto("Clothing", List.of("socks", "fleece")),
                        new SectionDto("Documents", List.of())));

        String message = RecommendationPrompts.userMessage(request);

        assertThat(message)
                .contains("Clothing: socks, fleece")
                .contains("Documents: (empty)");
    }
}
