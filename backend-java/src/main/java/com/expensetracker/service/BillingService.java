package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.dto.response.BillingUsage;
import com.expensetracker.dto.response.PlanOut;
import com.expensetracker.dto.response.UsageLogOut;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.Subscription;
import com.expensetracker.model.User;
import com.expensetracker.repository.SubscriptionRepository;
import com.expensetracker.repository.UsageLogRepository;
import com.expensetracker.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.*;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    private final SubscriptionRepository subscriptionRepository;
    private final UsageLogRepository usageLogRepository;
    private final UserRepository userRepository;
    private final AppProperties appProperties;

    private static final Map<String, String> PLAN_LABELS = Map.of(
        "free", "Free", "solo", "Solo", "pro", "Pro", "business", "Business"
    );
    private static final Map<String, Integer> PLAN_LIMITS = Map.of(
        "free", 15, "solo", 75, "pro", 300, "business", 1500
    );

    @PostConstruct
    public void init() {
        if (StringUtils.hasText(appProperties.getStripe().getSecretKey())) {
            Stripe.apiKey = appProperties.getStripe().getSecretKey();
        }
    }

    public BillingUsage getUsage(Long userId) {
        Subscription sub = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new EntityNotFoundException("Subscription not found"));

        var logs = usageLogRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().limit(20).map(l -> UsageLogOut.builder()
                        .id(l.getId()).statementId(l.getStatementId())
                        .pagesConsumed(l.getPagesConsumed()).action(l.getAction())
                        .createdAt(l.getCreatedAt()).build())
                .toList();

        return BillingUsage.builder()
                .plan(sub.getPlan())
                .planLabel(PLAN_LABELS.getOrDefault(sub.getPlan(), sub.getPlan()))
                .status(sub.getStatus())
                .pagesUsed(sub.getPagesUsed())
                .pagesLimit(sub.getPagesLimit())
                .pagesRemaining(Math.max(0, sub.getPagesLimit() - sub.getPagesUsed()))
                .overageEnabled(sub.isOverageEnabled())
                .currentPeriodStart(sub.getCurrentPeriodStart())
                .currentPeriodEnd(sub.getCurrentPeriodEnd())
                .usageLogs(logs)
                .build();
    }

    public List<PlanOut> getPlans() {
        return List.of(
            PlanOut.builder()
                .key("free").label("Free").priceUsd(0).pages(15).concurrent(1)
                .aiChat(false).overage(false).trialDays(0)
                .features(List.of("15 pages / month", "1 concurrent upload", "Auto-categorization"))
                .build(),
            PlanOut.builder()
                .key("solo").label("Solo").priceUsd(4.99).pages(75).concurrent(2)
                .aiChat(true).overage(false).trialDays(30)
                .features(List.of("75 pages / month", "2 concurrent uploads", "AI chat assistant", "30-day free trial"))
                .build(),
            PlanOut.builder()
                .key("pro").label("Pro").priceUsd(14.99).pages(300).concurrent(5)
                .aiChat(true).overage(false).trialDays(30)
                .features(List.of("300 pages / month", "5 concurrent uploads", "AI chat assistant", "Priority processing", "30-day free trial"))
                .build(),
            PlanOut.builder()
                .key("business").label("Business").priceUsd(39.99).pages(1500).concurrent(10)
                .aiChat(true).overage(true).overagePriceUsd(0.10).trialDays(30)
                .features(List.of("1 500 pages / month", "10 concurrent uploads", "AI chat assistant", "Overage billing ($0.10/page)", "Priority processing", "30-day free trial"))
                .build()
        );
    }

    @Transactional
    public Map<String, Object> createCheckout(Long userId, String plan) throws Exception {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        Subscription sub = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new EntityNotFoundException("Subscription not found"));

        String customerId = sub.getStripeCustomerId();
        if (!StringUtils.hasText(customerId)) {
            Customer customer = Customer.create(CustomerCreateParams.builder()
                    .setEmail(user.getEmail())
                    .setName(user.getUsername())
                    .build());
            customerId = customer.getId();
            sub.setStripeCustomerId(customerId);
            subscriptionRepository.save(sub);
        }

        String priceId = getPriceId(plan);
        boolean hasTrial = "free".equals(sub.getPlan());

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(customerId)
                .setSuccessUrl(appProperties.getCorsOriginsList().get(0) + "/billing?success=1")
                .setCancelUrl(appProperties.getCorsOriginsList().get(0) + "/billing?cancelled=true")
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setPrice(priceId).setQuantity(1L).build());

        if (hasTrial) {
            builder.setSubscriptionData(SessionCreateParams.SubscriptionData.builder()
                    .setTrialPeriodDays(30L).build());
        }

        Session session = Session.create(builder.build());
        return Map.of("checkout_url", session.getUrl(), "trial_days", hasTrial ? 30 : 0);
    }

    public Map<String, Object> createPortal(Long userId) throws Exception {
        Subscription sub = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new EntityNotFoundException("Subscription not found"));

        com.stripe.model.billingportal.Session portal = com.stripe.model.billingportal.Session.create(
            com.stripe.param.billingportal.SessionCreateParams.builder()
                .setCustomer(sub.getStripeCustomerId())
                .setReturnUrl(appProperties.getCorsOriginsList().get(0) + "/billing")
                .build()
        );
        return Map.of("portal_url", portal.getUrl());
    }

    @Transactional
    public void handleWebhook(String payload, String sigHeader) throws Exception {
        Event event;
        try {
            event = Webhook.constructEvent(payload, sigHeader, appProperties.getStripe().getWebhookSecret());
        } catch (SignatureVerificationException e) {
            throw new RuntimeException("Invalid Stripe signature");
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> {
                Session session = (Session) event.getDataObjectDeserializer().getObject().orElseThrow();
                String subId = session.getSubscription();
                if (subId != null) {
                    com.stripe.model.Subscription stripeSub = com.stripe.model.Subscription.retrieve(subId);
                    String customerId = session.getCustomer();
                    subscriptionRepository.findByStripeCustomerId(customerId).ifPresent(sub -> {
                        String plan = getPlanByPriceId(stripeSub.getItems().getData().get(0).getPrice().getId());
                        sub.setPlan(plan);
                        sub.setStripeSubscriptionId(subId);
                        sub.setPagesUsed(0);
                        sub.setPagesLimit(PLAN_LIMITS.getOrDefault(plan, 15));
                        sub.setStatus("active");
                        sub.setOverageEnabled("business".equals(plan));
                        subscriptionRepository.save(sub);
                    });
                }
            }
            case "customer.subscription.updated" -> {
                com.stripe.model.Subscription stripeSub = (com.stripe.model.Subscription) event.getDataObjectDeserializer().getObject().orElseThrow();
                subscriptionRepository.findByStripeSubscriptionId(stripeSub.getId()).ifPresent(sub -> {
                    sub.setStatus(stripeSub.getStatus());
                    subscriptionRepository.save(sub);
                });
            }
            case "customer.subscription.deleted" -> {
                com.stripe.model.Subscription stripeSub = (com.stripe.model.Subscription) event.getDataObjectDeserializer().getObject().orElseThrow();
                subscriptionRepository.findByStripeSubscriptionId(stripeSub.getId()).ifPresent(sub -> {
                    sub.setPlan("free");
                    sub.setPagesLimit(15);
                    sub.setStatus("canceled");
                    sub.setStripeSubscriptionId(null);
                    subscriptionRepository.save(sub);
                });
            }
            case "invoice.payment_succeeded" -> {
                Invoice invoice = (Invoice) event.getDataObjectDeserializer().getObject().orElseThrow();
                subscriptionRepository.findByStripeCustomerId(invoice.getCustomer()).ifPresent(sub -> {
                    sub.setPagesUsed(0);
                    if (invoice.getPeriodStart() != null) {
                        sub.setCurrentPeriodStart(OffsetDateTime.ofInstant(Instant.ofEpochSecond(invoice.getPeriodStart()), ZoneOffset.UTC));
                    }
                    if (invoice.getPeriodEnd() != null) {
                        sub.setCurrentPeriodEnd(OffsetDateTime.ofInstant(Instant.ofEpochSecond(invoice.getPeriodEnd()), ZoneOffset.UTC));
                    }
                    subscriptionRepository.save(sub);
                });
            }
            case "invoice.payment_failed" -> {
                Invoice invoice = (Invoice) event.getDataObjectDeserializer().getObject().orElseThrow();
                subscriptionRepository.findByStripeCustomerId(invoice.getCustomer()).ifPresent(sub -> {
                    sub.setStatus("past_due");
                    subscriptionRepository.save(sub);
                });
            }
            default -> log.debug("Unhandled Stripe event: {}", event.getType());
        }
    }

    private String getPriceId(String plan) {
        AppProperties.Stripe s = appProperties.getStripe();
        return switch (plan) {
            case "solo" -> s.getPriceSolo();
            case "pro" -> s.getPricePro();
            case "business" -> s.getPriceBusiness();
            default -> throw new IllegalArgumentException("Unknown plan: " + plan);
        };
    }

    private String getPlanByPriceId(String priceId) {
        AppProperties.Stripe s = appProperties.getStripe();
        if (priceId.equals(s.getPriceSolo())) return "solo";
        if (priceId.equals(s.getPricePro())) return "pro";
        if (priceId.equals(s.getPriceBusiness())) return "business";
        return "free";
    }
}
