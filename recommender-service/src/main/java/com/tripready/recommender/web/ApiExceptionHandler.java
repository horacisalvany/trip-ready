package com.tripready.recommender.web;

import com.tripready.recommender.service.QuotaExceededException;
import com.tripready.recommender.service.RecommendationUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(QuotaExceededException.class)
    public ResponseEntity<Void> handleQuotaExceeded() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
    }

    @ExceptionHandler(RecommendationUnavailableException.class)
    public ResponseEntity<Void> handleRecommendationUnavailable(RecommendationUnavailableException ex) {
        // The client only ever sees a generic 502 — the design spec collapses every model-call
        // failure (timeout, network, a Spring AI bug) into one message, since there is nothing a
        // user can do differently for any of them. But that genericness must not extend to the
        // logs: without logging the cause here, a real bug and routine Gemini flakiness would be
        // indistinguishable in production. Flagged by Task 6's code review.
        log.warn("Recommendation request failed", ex.getCause());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
    }
}
