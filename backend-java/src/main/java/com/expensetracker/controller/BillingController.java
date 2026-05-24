package com.expensetracker.controller;

import com.expensetracker.dto.response.BillingUsage;
import com.expensetracker.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    @GetMapping("/api/v1/billing/usage")
    public ResponseEntity<BillingUsage> usage(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok(billingService.getUsage(userId));
    }

    @GetMapping("/api/v1/billing/plans")
    public ResponseEntity<List<Map<String, Object>>> plans() {
        return ResponseEntity.ok(billingService.getPlans());
    }

    @PostMapping("/api/v1/billing/checkout")
    public ResponseEntity<Map<String, Object>> checkout(@RequestBody Map<String, String> req,
                                                         @AuthenticationPrincipal Long userId) throws Exception {
        return ResponseEntity.ok(billingService.createCheckout(userId, req.get("plan")));
    }

    @PostMapping("/api/v1/billing/portal")
    public ResponseEntity<Map<String, Object>> portal(@AuthenticationPrincipal Long userId) throws Exception {
        return ResponseEntity.ok(billingService.createPortal(userId));
    }

    @PostMapping("/api/v1/webhooks/stripe")
    public ResponseEntity<String> stripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) throws Exception {
        billingService.handleWebhook(payload, sigHeader);
        return ResponseEntity.ok("ok");
    }
}
