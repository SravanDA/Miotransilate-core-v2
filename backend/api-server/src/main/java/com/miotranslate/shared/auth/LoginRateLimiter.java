package com.miotranslate.shared.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class LoginRateLimiter {

    private final Cache<String, AtomicInteger> attemptsCache = Caffeine.newBuilder()
            .expireAfterWrite(15, TimeUnit.MINUTES)
            .maximumSize(10000)
            .build();

    public boolean isAllowed(String email) {
        AtomicInteger attempts = attemptsCache.get(email, k -> new AtomicInteger(0));
        return attempts.get() < 5;
    }

    public void recordFailedAttempt(String email) {
        AtomicInteger attempts = attemptsCache.get(email, k -> new AtomicInteger(0));
        attempts.incrementAndGet();
    }

    public void resetAttempts(String email) {
        attemptsCache.invalidate(email);
    }
}
