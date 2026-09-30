package com.tripready.recommender.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void acceptsARequestWithinAllLimits() {
        RecommendationRequest request = new RecommendationRequest(
                "Japan trip",
                "2 weeks in November",
                List.of(new SectionDto("Clothing", List.of("socks"))));

        Set<ConstraintViolation<RecommendationRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void acceptsATitleAndNoteThatAreBothAbsent() {
        RecommendationRequest request = new RecommendationRequest(null, null, List.of());

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsATripNoteOverTwoHundredCharacters() {
        RecommendationRequest request = new RecommendationRequest("Trip", "a".repeat(201), List.of());

        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void rejectsATitleOverFortyCharacters() {
        RecommendationRequest request = new RecommendationRequest("a".repeat(41), null, List.of());

        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void rejectsMoreThanThirtySections() {
        List<SectionDto> tooManySections = IntStream.range(0, 31)
                .mapToObj(i -> new SectionDto("Section " + i, List.of()))
                .toList();
        RecommendationRequest request = new RecommendationRequest("Trip", null, tooManySections);

        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void rejectsASectionWithABlankName() {
        RecommendationRequest request = new RecommendationRequest(
                "Trip", null, List.of(new SectionDto("  ", List.of("socks"))));

        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void rejectsMoreThanOneHundredItemsInASection() {
        List<String> tooManyItems = IntStream.range(0, 101).mapToObj(i -> "item " + i).toList();
        RecommendationRequest request = new RecommendationRequest(
                "Trip", null, List.of(new SectionDto("Clothing", tooManyItems)));

        assertThat(validator.validate(request)).isNotEmpty();
    }

    @Test
    void rejectsABlankItemName() {
        RecommendationRequest request = new RecommendationRequest(
                "Trip", null, List.of(new SectionDto("Clothing", List.of(" "))));

        assertThat(validator.validate(request)).isNotEmpty();
    }
}
