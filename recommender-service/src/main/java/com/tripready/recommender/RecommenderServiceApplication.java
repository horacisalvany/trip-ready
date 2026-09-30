package com.tripready.recommender;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.time.Clock;

@SpringBootApplication
public class RecommenderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RecommenderServiceApplication.class, args);
    }

    /** Injected wherever "now" matters, so tests can substitute a fixed or advancing clock. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
