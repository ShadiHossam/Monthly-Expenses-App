package com.expensetracker.controller;

import com.expensetracker.config.AppProperties;
import com.expensetracker.dto.request.GmailSenderRequest;
import com.expensetracker.dto.request.GmailSyncDaysRequest;
import com.expensetracker.dto.response.GmailStatusOut;
import com.expensetracker.model.GmailFilterSender;
import com.expensetracker.model.User;
import com.expensetracker.repository.GmailFilterSenderRepository;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.service.GmailPollerService;
import com.expensetracker.service.GmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/gmail")
@RequiredArgsConstructor
@Slf4j
public class GmailController {

    private final GmailService gmailService;
    private final GmailPollerService pollerService;
    private final UserRepository userRepository;
    private final GmailFilterSenderRepository senderRepo;
    private final AppProperties appProperties;

    private final ConcurrentHashMap<Long, Instant> lastSyncTime = new ConcurrentHashMap<>();

    @GetMapping("/connect-url")
    public ResponseEntity<Map<String, String>> connectUrl(@AuthenticationPrincipal Long userId) {
        String url = gmailService.buildAuthUrl(userId);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam String code,
                                          @RequestParam String state) {
        String redirectUrl;
        try {
            Long userId = gmailService.validateAndConsumeState(state);
            Map<String, String> tokens = gmailService.exchangeCode(code);
            String email = gmailService.fetchGmailEmail(tokens.get("access_token"));
            userRepository.findById(userId).ifPresent(user -> {
                user.setGmailRefreshToken(tokens.get("refresh_token"));
                user.setGmailEmail(email);
                userRepository.save(user);
            });
            redirectUrl = appProperties.getAppUrl() + "/settings?gmail=connected";
        } catch (Exception e) {
            log.error("Gmail OAuth callback failed", e);
            redirectUrl = appProperties.getAppUrl() + "/settings?gmail=error";
        }
        return ResponseEntity.status(302).location(URI.create(redirectUrl)).build();
    }

    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal Long userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setGmailRefreshToken(null);
            user.setGmailEmail(null);
            userRepository.save(user);
        });
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public ResponseEntity<GmailStatusOut> status(@AuthenticationPrincipal Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        var senders = senderRepo.findByUserId(userId).stream()
            .map(s -> GmailStatusOut.SenderOut.builder()
                .id(s.getId()).senderEmail(s.getSenderEmail()).build())
            .toList();
        return ResponseEntity.ok(GmailStatusOut.builder()
            .connected(user.getGmailRefreshToken() != null)
            .gmailEmail(user.getGmailEmail())
            .syncDays(user.getGmailSyncDays())
            .senders(senders)
            .build());
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> sync(@AuthenticationPrincipal Long userId) {
        Instant now = Instant.now();
        Instant last = lastSyncTime.get(userId);
        if (last != null && now.isBefore(last.plusSeconds(60))) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Please wait before triggering another sync");
        }
        lastSyncTime.put(userId, now);
        int imported = pollerService.syncUserById(userId);
        return ResponseEntity.ok(Map.of("imported", imported));
    }

    @PostMapping("/senders")
    public ResponseEntity<GmailStatusOut.SenderOut> addSender(
            @AuthenticationPrincipal Long userId,
            @RequestBody GmailSenderRequest req) {
        if (senderRepo.existsByUserIdAndSenderEmail(userId, req.getSenderEmail())) {
            return ResponseEntity.ok(senderRepo.findByUserId(userId).stream()
                .filter(s -> s.getSenderEmail().equals(req.getSenderEmail()))
                .map(s -> GmailStatusOut.SenderOut.builder()
                    .id(s.getId()).senderEmail(s.getSenderEmail()).build())
                .findFirst().orElseThrow());
        }
        GmailFilterSender saved = senderRepo.save(GmailFilterSender.builder()
            .userId(userId).senderEmail(req.getSenderEmail()).build());
        return ResponseEntity.ok(GmailStatusOut.SenderOut.builder()
            .id(saved.getId()).senderEmail(saved.getSenderEmail()).build());
    }

    @DeleteMapping("/senders/{id}")
    public ResponseEntity<Void> removeSender(@PathVariable Long id,
                                              @AuthenticationPrincipal Long userId) {
        senderRepo.deleteByIdAndUserId(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/sync-days")
    public ResponseEntity<Map<String, String>> updateSyncDays(
            @AuthenticationPrincipal Long userId,
            @RequestBody GmailSyncDaysRequest req) {
        String raw = req.getSyncDays();
        if (raw != null && !raw.isBlank()) {
            // Validate: must be comma-separated integers each in 1–31
            try {
                for (String part : raw.split(",")) {
                    int day = Integer.parseInt(part.trim());
                    if (day < 1 || day > 31) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "syncDays values must be between 1 and 31");
                    }
                }
            } catch (NumberFormatException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "syncDays must be comma-separated integers");
            }
        }
        userRepository.findById(userId).ifPresent(user -> {
            user.setGmailSyncDays(raw);
            userRepository.save(user);
        });
        return ResponseEntity.ok(Map.of("syncDays", raw != null ? raw : ""));
    }
}
