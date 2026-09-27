package com.tripready.recommender.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RecommendationRequest(
        @Size(max = 40) String listTitle,
        @Size(max = 200) String tripNote,
        @NotNull @Size(max = 30) @Valid List<SectionDto> sections) {
}
