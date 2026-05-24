package com.expensetracker.controller;

import com.expensetracker.dto.request.BudgetRequest;
import com.expensetracker.dto.response.BudgetStatusOut;
import com.expensetracker.model.BudgetAlert;
import com.expensetracker.service.BudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    @GetMapping
    public ResponseEntity<List<BudgetAlert>> list(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(budgetService.list(userId));
    }

    @PostMapping
    public ResponseEntity<BudgetAlert> create(@Valid @RequestBody BudgetRequest req,
                                               @AuthenticationPrincipal Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(budgetService.create(userId, req));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<BudgetAlert> update(@PathVariable Long id,
                                               @RequestBody Map<String, Object> updates,
                                               @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(budgetService.update(id, userId, updates));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        budgetService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public ResponseEntity<List<BudgetStatusOut>> status(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(budgetService.status(userId));
    }
}
