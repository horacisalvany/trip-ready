package com.tripready.recommender.web;

import com.tripready.recommender.dto.RecommendationRequest;
import com.tripready.recommender.dto.SuggestionList;
import com.tripready.recommender.service.RecommendationService;
import jakarta.validation.Valid;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @PostMapping
    public SuggestionList suggest(@Valid @RequestBody RecommendationRequest request, @AuthenticationPrincipal Jwt jwt) {
        return recommendationService.recommend(request, jwt.getSubject());
    }
}
