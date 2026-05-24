package com.expensetracker.controller;

import com.expensetracker.dto.request.AiChatRequest;
import com.expensetracker.model.User;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.service.AiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@Valid @RequestBody AiChatRequest req,
                                                     @AuthenticationPrincipal Long userId) {
        String answer = aiService.chat(userId, req);
        return ResponseEntity.ok(Map.of("data", Map.of("answer", answer)));
    }
}
