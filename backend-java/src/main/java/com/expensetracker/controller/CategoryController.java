package com.expensetracker.controller;

import com.expensetracker.dto.request.CategoryRequest;
import com.expensetracker.dto.response.CategoryOut;
import com.expensetracker.service.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ResponseEntity<List<CategoryOut>> list(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(categoryService.list(userId));
    }

    @PostMapping
    public ResponseEntity<CategoryOut> create(@Valid @RequestBody CategoryRequest req,
                                              @AuthenticationPrincipal Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.create(userId, req));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<CategoryOut> update(@PathVariable Long id,
                                              @RequestBody CategoryRequest req,
                                              @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(categoryService.update(id, userId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        categoryService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
