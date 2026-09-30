package com.tripready.recommender.service;

/** Thrown when the underlying model call fails — timeout, network, or an upstream error. */
public class RecommendationUnavailableException extends RuntimeException {

    public RecommendationUnavailableException(Throwable cause) {
        super(cause);
    }
}
