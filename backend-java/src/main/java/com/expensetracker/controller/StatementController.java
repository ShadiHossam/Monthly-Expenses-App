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
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/statements")
@RequiredArgsConstructor
public class StatementController {

    private final StatementService statementService;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "confirm_overage", defaultValue = "false") boolean confirmOverage,
            @AuthenticationPrincipal Long userId) throws IOException {
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
}
