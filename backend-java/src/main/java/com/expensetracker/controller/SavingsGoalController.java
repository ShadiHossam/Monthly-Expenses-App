package com.expensetracker.controller;

import com.expensetracker.model.SavingsGoal;
import com.expensetracker.service.SavingsGoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/savings-goals")
@RequiredArgsConstructor
public class SavingsGoalController {

    private final SavingsGoalService service;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(service.listWithProgress(userId));
    }

    @PostMapping
    public ResponseEntity<SavingsGoal> create(@AuthenticationPrincipal Long userId,
                                               @RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        service.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
