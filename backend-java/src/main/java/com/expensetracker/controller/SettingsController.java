package com.expensetracker.controller;

import com.expensetracker.dto.request.AiSettingsRequest;
import com.expensetracker.dto.response.UserOut;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.User;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final UserRepository userRepository;

    @GetMapping("/ai")
    public ResponseEntity<UserOut> getAiSettings(@AuthenticationPrincipal Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        return ResponseEntity.ok(AuthService.toUserOut(user));
    }

    @PutMapping("/ai")
    public ResponseEntity<UserOut> updateAiSettings(@RequestBody AiSettingsRequest req,
                                                      @AuthenticationPrincipal Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        if (req.getGroqApiKey() != null) user.setGroqApiKey(req.getGroqApiKey());
        if (req.getOpenrouterApiKey() != null) user.setOpenrouterApiKey(req.getOpenrouterApiKey());
        if (req.getAnthropicApiKey() != null) user.setAnthropicApiKey(req.getAnthropicApiKey());
        if (StringUtils.hasText(req.getAiProvider())) user.setAiProvider(req.getAiProvider());
        if (req.getConcurrentProcessing() != null && req.getConcurrentProcessing() >= 1
                && req.getConcurrentProcessing() <= 10) {
            user.setConcurrentProcessing(req.getConcurrentProcessing());
        }

        user = userRepository.save(user);
        return ResponseEntity.ok(AuthService.toUserOut(user));
    }
}
