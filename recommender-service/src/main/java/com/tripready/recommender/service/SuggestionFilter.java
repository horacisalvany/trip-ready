package com.tripready.recommender.service;

import com.tripready.recommender.dto.Suggestion;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Removes suggestions that duplicate an item already on the list, or each other, and caps the
 * result. Enforced here rather than asked of the prompt: models repeat items no matter how
 * firmly they are told not to, and this is cheap and fully deterministic.
 */
public final class SuggestionFilter {

    private SuggestionFilter() {
    }

    public static List<Suggestion> filter(
            List<Suggestion> suggestions, Set<String> existingItemNamesLowercase, int maxSuggestions) {
        List<Suggestion> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (Suggestion suggestion : suggestions) {
            String key = suggestion.name().trim().toLowerCase(Locale.ROOT);
            if (existingItemNamesLowercase.contains(key) || !seen.add(key)) {
                continue;
            }
            result.add(suggestion);
            if (result.size() == maxSuggestions) {
                break;
            }
        }

        return result;
    }
}
