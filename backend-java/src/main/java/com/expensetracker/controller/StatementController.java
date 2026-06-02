package com.expensetracker.controller;

import com.expensetracker.dto.response.StatementOut;
import com.expensetracker.service.StatementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/statements")
@RequiredArgsConstructor
public class StatementController {

    private final StatementService statementService;
    private final ConcurrentHashMap<Long, Deque<Instant>> uploadTimestamps = new ConcurrentHashMap<>();

    private void checkUploadRateLimit(Long userId) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(60);
        Deque<Instant> times = uploadTimestamps.computeIfAbsent(userId, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst().isBefore(windowStart)) times.pollFirst();
            if (times.size() >= 5) {
                throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                    "Too many uploads. Please wait before uploading more files.");
            }
            times.addLast(now);
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "confirm_overage", defaultValue = "false") boolean confirmOverage,
            @AuthenticationPrincipal Long userId) throws IOException {
        checkUploadRateLimit(userId);
        return ResponseEntity.ok(statementService.upload(file, userId, confirmOverage));
    }

    @GetMapping(value = "/{id}/progress", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter progress(@PathVariable Long id) {
        return statementService.getProgressEmitter(id);
    }

    @GetMapping
    public ResponseEntity<List<StatementOut>> list(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(statementService.listStatements(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StatementOut> get(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(statementService.getStatement(id, userId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Long userId) throws IOException {
        statementService.deleteStatement(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reverify")
    public ResponseEntity<StatementOut> reverify(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(statementService.reverify(id, userId));
    }

    @PostMapping("/reverify-pending")
    public ResponseEntity<Map<String, Object>> reverifyAllPending(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(statementService.reverifyAllPending(userId));
    }
}
