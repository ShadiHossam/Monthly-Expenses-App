package com.expensetracker.controller;

import com.expensetracker.model.RecurringRule;
import com.expensetracker.service.RecurringRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/recurring-rules")
@RequiredArgsConstructor
public class RecurringRuleController {

    private final RecurringRuleService service;

    @GetMapping
    public ResponseEntity<List<RecurringRule>> list(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.list(userId));
    }

    @PostMapping
    public ResponseEntity<RecurringRule> create(@AuthenticationPrincipal Long userId,
                                                 @RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, body));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<RecurringRule> update(@PathVariable Long id,
                                                 @AuthenticationPrincipal Long userId,
                                                 @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(service.update(id, userId, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        service.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
