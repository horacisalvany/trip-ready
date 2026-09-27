package com.tripready.recommender.dto;

import java.util.List;

/** Both the shape Gemini is asked to return, and the shape the API responds with. */
public record SuggestionList(List<Suggestion> suggestions) {
}
