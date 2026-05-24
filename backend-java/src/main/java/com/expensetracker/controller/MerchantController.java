package com.expensetracker.controller;

import com.expensetracker.dto.request.MerchantRuleRequest;
import com.expensetracker.model.MerchantAlias;
import com.expensetracker.model.MerchantRule;
import com.expensetracker.service.MerchantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class MerchantController {

    private final MerchantService merchantService;

    // Merchants
    @GetMapping("/api/v1/merchants")
    public ResponseEntity<Map<String, Object>> listMerchants(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(Map.of("data", merchantService.listMerchants(userId)));
    }

    @GetMapping("/api/v1/merchants/frequent")
    public ResponseEntity<Map<String, Object>> frequentMerchants(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(Map.of("data", merchantService.frequentMerchants(userId)));
    }

    @GetMapping("/api/v1/merchants/ranking")
    public ResponseEntity<Map<String, Object>> ranking(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(Map.of("data", merchantService.ranking(userId, Math.min(limit, 100))));
    }

    @GetMapping("/api/v1/merchants/{name}/transactions")
    public ResponseEntity<Map<String, Object>> merchantTransactions(
            @PathVariable String name,
            @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(Map.of("data", merchantService.merchantTransactions(userId, name)));
    }

    // Merchant rules
    @GetMapping("/api/v1/merchant-rules")
    public ResponseEntity<List<MerchantRule>> listRules(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(merchantService.listRules(userId));
    }

    @PostMapping("/api/v1/merchant-rules")
    public ResponseEntity<MerchantRule> createRule(@Valid @RequestBody MerchantRuleRequest req,
                                                   @AuthenticationPrincipal Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(merchantService.createRule(userId, req));
    }

    @PatchMapping("/api/v1/merchant-rules/{id}")
    public ResponseEntity<MerchantRule> updateRule(@PathVariable Long id,
                                                   @RequestBody MerchantRuleRequest req,
                                                   @AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(merchantService.updateRule(id, userId, req));
    }

    @DeleteMapping("/api/v1/merchant-rules/{id}")
    public ResponseEntity<Void> deleteRule(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        merchantService.deleteRule(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/merchant-rules/test")
    public ResponseEntity<Map<String, Object>> testRule(@RequestBody Map<String, String> req) {
        boolean matched = merchantService.testRule(req.get("pattern"), req.get("pattern_type"), req.get("sample_text"));
        return ResponseEntity.ok(Map.of("data", Map.of("matched", matched)));
    }

    // Merchant aliases
    @GetMapping("/api/v1/merchant-aliases")
    public ResponseEntity<List<MerchantAlias>> listAliases(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(merchantService.listAliases(userId));
    }

    @PostMapping("/api/v1/merchant-aliases")
    public ResponseEntity<MerchantAlias> createAlias(@RequestBody Map<String, String> req,
                                                     @AuthenticationPrincipal Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(merchantService.createAlias(userId, req.get("raw_name"), req.get("display_name")));
    }

    @DeleteMapping("/api/v1/merchant-aliases/{id}")
    public ResponseEntity<Void> deleteAlias(@PathVariable Long id, @AuthenticationPrincipal Long userId) {
        merchantService.deleteAlias(id, userId);
        return ResponseEntity.noContent().build();
    }
}
