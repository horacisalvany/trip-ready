package com.tripready.recommender.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SectionDto(
        @NotBlank @Size(max = 40) String name,
        @NotNull @Size(max = 100) List<@NotBlank String> items) {
}
