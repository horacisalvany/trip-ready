package com.tripready.recommender.prompt;

import com.tripready.recommender.dto.RecommendationRequest;
import com.tripready.recommender.dto.SectionDto;

/**
 * Builds the two halves of the request to the model. The trip note is user-controlled text and
 * must only ever appear in the user message — see F12's Technical Notes on prompt injection.
 */
public final class RecommendationPrompts {

    public static final String SYSTEM = """
            You suggest items a traveller may have forgotten to pack, based on a packing list
            they already started.

            Rules:
            - Suggest only items that are not already on the list, in any section.
            - Suggest at most 10 items.
            - Prefer items relevant to the trip note when one is given; otherwise use the list
              title and its sections as your only context.
            - Assign each suggestion to one of the traveller's existing sections when it clearly
              belongs there. If no existing section fits, invent a short, clear section name
              (2-3 words) for it.
            - Give a one-sentence reason for each suggestion, naming what makes it likely needed
              (climate, duration, a stated detail from the note).
            - If the list already looks complete, return an empty list rather than inventing
              filler items.

            Respond with the requested structured format only.
            """;

    private RecommendationPrompts() {
    }

    public static String userMessage(RecommendationRequest request) {
        StringBuilder message = new StringBuilder();
        message.append("Trip: ").append(hasText(request.listTitle()) ? request.listTitle() : "Untitled trip").append('\n');
        message.append("Note: ").append(hasText(request.tripNote()) ? request.tripNote() : "(none)").append('\n');
        message.append("Current list:\n");

        for (SectionDto section : request.sections()) {
            message.append("- ").append(section.name()).append(": ");
            message.append(section.items().isEmpty() ? "(empty)" : String.join(", ", section.items()));
            message.append('\n');
        }

        return message.toString();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
