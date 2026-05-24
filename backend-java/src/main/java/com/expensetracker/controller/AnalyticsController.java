package com.expensetracker.controller;

import com.expensetracker.dto.response.AnalyticsSummary;
import com.expensetracker.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/summary")
    public ResponseEntity<AnalyticsSummary> summary(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(analyticsService.summary(userId, from, to));
    }

    @GetMapping("/monthly")
    public ResponseEntity<List<Map<String, Object>>> monthly(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Integer year) {
        int y = year != null ? year : java.time.LocalDate.now().getYear();
        return ResponseEntity.ok(analyticsService.monthly(userId, y));
    }

    @GetMapping("/category-breakdown")
    public ResponseEntity<List<Map<String, Object>>> categoryBreakdown(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(analyticsService.categoryBreakdown(userId, from, to));
    }

    @GetMapping("/frequent-places")
    public ResponseEntity<List<Map<String, Object>>> frequentPlaces(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(analyticsService.frequentPlaces(userId, from, to));
    }

    @GetMapping("/balance-trend")
    public ResponseEntity<List<Map<String, Object>>> balanceTrend(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(analyticsService.balanceTrend(userId));
    }

    @GetMapping("/recurring")
    public ResponseEntity<List<Map<String, Object>>> recurring(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(analyticsService.recurring(userId));
    }

    @GetMapping("/month-comparison")
    public ResponseEntity<List<Map<String, Object>>> monthComparison(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "6") int months) {
        return ResponseEntity.ok(analyticsService.monthComparison(userId, Math.min(months, 12)));
    }
}
