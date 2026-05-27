package com.expensetracker.controller;

import com.expensetracker.dto.request.SaveReportRequest;
import com.expensetracker.model.SavedReport;
import com.expensetracker.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/generate")
    public ResponseEntity<Map<String, Object>> generate(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from_date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to_date) {
        return ResponseEntity.ok(Map.of("data", reportService.generate(userId, from_date, to_date)));
    }

    @GetMapping("/saved")
    public ResponseEntity<List<SavedReport>> listSaved(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(reportService.listSaved(userId));
    }

    @PostMapping("/saved")
    public ResponseEntity<SavedReport> save(@Valid @RequestBody SaveReportRequest req,
                                             @AuthenticationPrincipal Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reportService.save(userId, req));
    }

    @DeleteMapping("/saved/{id}")
    public ResponseEntity<Void> deleteSaved(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        reportService.deleteSaved(id, userId);
        return ResponseEntity.noContent().build();
    }
}
