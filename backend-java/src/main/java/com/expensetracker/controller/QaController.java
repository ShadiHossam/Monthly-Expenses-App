package com.expensetracker.controller;

import com.expensetracker.dto.request.QaAnswerRequest;
import com.expensetracker.service.QaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/qa")
@RequiredArgsConstructor
public class QaController {

    private final QaService qaService;

    @GetMapping("/pending")
    public ResponseEntity<List<Map<String, Object>>> pending(
            @AuthenticationPrincipal Long userId,
            @RequestParam(name = "statement_id", required = false) Long statementId) {
        return ResponseEntity.ok(qaService.pending(userId, statementId));
    }

    @PostMapping("/answer")
    public ResponseEntity<Map<String, Object>> answer(@RequestBody QaAnswerRequest req,
                                                       @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(qaService.answer(userId, req));
    }

    @PostMapping("/skip")
    public ResponseEntity<Map<String, Object>> skip(@RequestBody QaAnswerRequest req,
                                                     @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(qaService.skip(userId, req));
    }

    @PostMapping("/answer-batch")
    public ResponseEntity<Map<String, Object>> answerBatch(@RequestBody List<QaAnswerRequest> reqs,
                                                            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(qaService.answerBatch(userId, reqs));
    }
}
