package com.expensetracker.controller;

import com.expensetracker.dto.request.BulkCategorizeRequest;
import com.expensetracker.dto.response.TransactionOut;
import com.expensetracker.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    @GetMapping
    public ResponseEntity<Page<TransactionOut>> list(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "category_id", required = false) Long categoryId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        String s = (search != null && !search.isBlank()) ? search : "";
        return ResponseEntity.ok(transactionService.list(userId, from, to, categoryId, type, s, limit, offset));
    }

    @GetMapping("/uncategorized")
    public ResponseEntity<List<TransactionOut>> uncategorized(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(transactionService.listUncategorized(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransactionOut> get(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(transactionService.getById(id, userId));
    }

    @PatchMapping("/{id}/category")
    public ResponseEntity<TransactionOut> updateCategory(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body,
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(transactionService.updateCategory(id, userId, body.get("category_id")));
    }

    @PostMapping("/bulk-categorize")
    public ResponseEntity<Map<String, Object>> bulkCategorize(
            @Valid @RequestBody BulkCategorizeRequest req,
            @AuthenticationPrincipal Long userId) {
        int updated = transactionService.bulkCategorize(userId, req);
        return ResponseEntity.ok(Map.of("data", Map.of("updated", updated)));
    }

    @GetMapping("/export/csv")
    public ResponseEntity<StreamingResponseBody> exportCsv(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "category_id", required = false) Long categoryId) {
        StreamingResponseBody body = out -> transactionService.streamCsv(userId, from, to, categoryId, out);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"transactions.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(body);
    }
}
