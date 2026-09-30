package com.tripready.recommender.service;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class QuotaServiceTest {

    @Test
    void allowsRequestsUpToTheDailyLimit() {
        QuotaService quotaService = new QuotaService(3, new MutableClock(Instant.parse("2026-01-01T00:00:00Z")));

        assertThat(quotaService.tryConsume("user-1")).isTrue();
        assertThat(quotaService.tryConsume("user-1")).isTrue();
        assertThat(quotaService.tryConsume("user-1")).isTrue();
        assertThat(quotaService.tryConsume("user-1")).isFalse();
    }

    @Test
    void tracksEachUserSeparately() {
        QuotaService quotaService = new QuotaService(1, new MutableClock(Instant.parse("2026-01-01T00:00:00Z")));

        assertThat(quotaService.tryConsume("user-1")).isTrue();
        assertThat(quotaService.tryConsume("user-2")).isTrue();
        assertThat(quotaService.tryConsume("user-1")).isFalse();
    }

    @Test
    void resetsTwentyFourHoursAfterTheFirstRequestOfTheWindow() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        QuotaService quotaService = new QuotaService(1, clock);

        assertThat(quotaService.tryConsume("user-1")).isTrue();
        assertThat(quotaService.tryConsume("user-1")).isFalse();

        clock.advance(Duration.ofHours(24).plusSeconds(1));

        assertThat(quotaService.tryConsume("user-1")).isTrue();
    }

    /** A Clock whose instant can be moved forward within a test, without a real 24h wait. */
    private static final class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            throw new UnsupportedOperationException("not needed in this test");
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
