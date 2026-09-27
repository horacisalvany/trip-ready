package com.tripready.recommender.service;

import com.tripready.recommender.dto.RecommendationRequest;
import com.tripready.recommender.dto.Suggestion;
import com.tripready.recommender.dto.SuggestionList;
import com.tripready.recommender.prompt.RecommendationPrompts;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private static final int MAX_SUGGESTIONS = 10;

    private final ChatClient chatClient;
    private final QuotaService quotaService;

    public RecommendationService(ChatClient.Builder chatClientBuilder, QuotaService quotaService) {
        this.chatClient = chatClientBuilder.build();
        this.quotaService = quotaService;
    }

    public SuggestionList recommend(RecommendationRequest request, String uid) {
        if (!quotaService.tryConsume(uid)) {
            throw new QuotaExceededException();
        }

        SuggestionList raw;
        try {
            raw = chatClient.prompt()
                    .system(RecommendationPrompts.SYSTEM)
                    .user(RecommendationPrompts.userMessage(request))
                    .call()
                    .entity(SuggestionList.class);
        } catch (RuntimeException ex) {
            throw new RecommendationUnavailableException(ex);
        }

        List<Suggestion> suggestions = raw == null ? List.of() : raw.suggestions();
        List<Suggestion> filtered = SuggestionFilter.filter(suggestions, existingItemNames(request), MAX_SUGGESTIONS);
        return new SuggestionList(filtered);
    }

    private static Set<String> existingItemNames(RecommendationRequest request) {
        return request.sections().stream()
                .flatMap(section -> section.items().stream())
                .map(item -> item.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }
}
