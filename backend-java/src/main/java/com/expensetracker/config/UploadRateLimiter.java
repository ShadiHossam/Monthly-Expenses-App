package com.expensetracker.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Limits uploads to 10 per minute per user.
 * Uses a sliding window reset keyed on (userId, minute).
 */
@Component
public class UploadRateLimiter implements HandlerInterceptor {

    private static final int MAX_UPLOADS_PER_MINUTE = 10;
    private final ConcurrentHashMap<String, AtomicInteger> counts = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!"POST".equals(request.getMethod())
                || !request.getRequestURI().contains("/statements/upload")) {
            return true;
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) return true;

        String key = auth.getPrincipal() + ":" + (System.currentTimeMillis() / 60_000);
        AtomicInteger counter = counts.computeIfAbsent(key, k -> new AtomicInteger(0));
        int current = counter.incrementAndGet();

        // Evict stale keys roughly — remove keys from previous minutes
        counts.entrySet().removeIf(e -> {
            String[] parts = e.getKey().split(":");
            if (parts.length < 2) return true;
            try {
                long keyMinute = Long.parseLong(parts[parts.length - 1]);
                return keyMinute < (System.currentTimeMillis() / 60_000) - 1;
            } catch (NumberFormatException ex) {
                return true;
            }
        });

        if (current > MAX_UPLOADS_PER_MINUTE) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"detail\":\"Upload rate limit exceeded. Max " + MAX_UPLOADS_PER_MINUTE + " uploads per minute.\"}");
            return false;
        }
        return true;
    }
}
