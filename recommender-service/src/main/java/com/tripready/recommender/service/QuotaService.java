package com.tripready.recommender.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A per-user daily request cap, held in memory. Its purpose is fairness — stopping one signed-in
 * user from exhausting the free-tier quota shared by everyone — not protecting a bill, since the
 * free tier cannot be overspent. It resets on cold start and is not shared across instances; see
 * F12's design doc for why that is an acceptable limitation here and not once a paid provider
 * is in use.
 */
@Service
public class QuotaService {

    private final int dailyLimit;
    private final Clock clock;
    private final ConcurrentHashMap<String, Window> usage = new ConcurrentHashMap<>();

    public QuotaService(@Value("${app.quota.daily-limit:10}") int dailyLimit, Clock clock) {
        this.dailyLimit = dailyLimit;
        this.clock = clock;
    }

    public boolean tryConsume(String uid) {
        Instant now = clock.instant();
        Window window = usage.compute(uid, (key, existing) -> {
            if (existing == null || now.isAfter(existing.resetAt)) {
                return new Window(new AtomicInteger(0), now.plus(Duration.ofDays(1)));
            }
            return existing;
        });
        return window.count.incrementAndGet() <= dailyLimit;
    }

    private static final class Window {
        private final AtomicInteger count;
        private final Instant resetAt;

        Window(AtomicInteger count, Instant resetAt) {
            this.count = count;
            this.resetAt = resetAt;
        }
    }
}
