package com.tripready.recommender.service;

import com.tripready.recommender.dto.Suggestion;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class SuggestionFilterTest {

    @Test
    void keepsASuggestionNotAlreadyOnTheList() {
        List<Suggestion> suggestions = List.of(new Suggestion("Rain jacket", "Clothing", "It rains in November"));

        List<Suggestion> result = SuggestionFilter.filter(suggestions, Set.of("socks"), 10);

        assertThat(result).containsExactly(new Suggestion("Rain jacket", "Clothing", "It rains in November"));
    }

    @Test
    void dropsASuggestionAlreadyOnTheListRegardlessOfCase() {
        List<Suggestion> suggestions = List.of(new Suggestion("Passport", "Documents", "Needed to travel"));

        List<Suggestion> result = SuggestionFilter.filter(suggestions, Set.of("passport"), 10);

        assertThat(result).isEmpty();
    }

    @Test
    void dropsARepeatedSuggestionKeepingOnlyTheFirst() {
        List<Suggestion> suggestions = List.of(
                new Suggestion("Rain jacket", "Clothing", "Reason A"),
                new Suggestion("rain jacket", "Clothing", "Reason B"));

        List<Suggestion> result = SuggestionFilter.filter(suggestions, Set.of(), 10);

        assertThat(result).containsExactly(new Suggestion("Rain jacket", "Clothing", "Reason A"));
    }

    @Test
    void capsAtTheGivenMaximum() {
        List<Suggestion> elevenSuggestions = IntStream.range(0, 11)
                .mapToObj(i -> new Suggestion("Item " + i, "Section", "Reason"))
                .toList();

        List<Suggestion> result = SuggestionFilter.filter(elevenSuggestions, Set.of(), 10);

        assertThat(result).hasSize(10);
    }

    @Test
    void returnsAnEmptyListWhenGivenNoSuggestions() {
        assertThat(SuggestionFilter.filter(List.of(), Set.of("socks"), 10)).isEmpty();
    }
}
