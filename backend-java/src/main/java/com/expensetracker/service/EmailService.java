package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.util.Map;

@Service
@Slf4j
public class EmailService {

    private final WebClient resendClient;
    private final AppProperties appProperties;

    public EmailService(@Qualifier("resendClient") WebClient resendClient,
                        AppProperties appProperties) {
        this.resendClient = resendClient;
        this.appProperties = appProperties;
    }

    @Async
    public void sendPasswordReset(String toEmail, String token) {
        String resetUrl = appProperties.getAppUrl() + "/reset-password?token=" + token;
        String html = "<p>Click the link below to reset your password (expires in 1 hour):</p>"
                + "<p><a href=\"" + resetUrl + "\">" + resetUrl + "</a></p>"
                + "<p>If you did not request this, ignore this email.</p>";
        sendEmail(toEmail, "Reset your Expense Tracker password", html);
    }

    // Synchronous so callers can decide whether to record the alert only after a successful send.
    public boolean sendBudgetAlert(String toEmail, String categoryName,
                                   BigDecimal spent, BigDecimal limit) {
        String html = "<p>You have exceeded your <strong>" + categoryName + "</strong> budget.</p>"
                + "<p>Spent: AED " + spent + " / Limit: AED " + limit + "</p>"
                + "<p><a href=\"" + appProperties.getAppUrl() + "/budget\">View your budgets</a></p>";
        return sendEmail(toEmail, "Budget Alert: " + categoryName + " limit exceeded", html);
    }

    private boolean sendEmail(String to, String subject, String html) {
        if (appProperties.getResend().getApiKey().isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping email to {}", to);
            return false;
        }
        try {
            resendClient.post()
                    .uri("/emails")
                    .bodyValue(Map.of(
                            "from", appProperties.getResend().getFrom(),
                            "to", to,
                            "subject", subject,
                            "html", html
                    ))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("Email sent to {} — subject: {}", to, subject);
            return true;
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            return false;
        }
    }
}
