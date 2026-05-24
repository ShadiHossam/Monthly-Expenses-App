package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.dto.request.AiChatRequest;
import com.expensetracker.exception.BusinessException;
import com.expensetracker.model.Category;
import com.expensetracker.model.User;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.SubscriptionRepository;
import com.expensetracker.repository.TransactionRepository;
import com.expensetracker.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class AiService {

    private final WebClient groqClient;
    private final WebClient anthropicClient;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final CategoryRepository categoryRepository;
    private final AnalyticsService analyticsService;
    private final AiProviderResolver resolver;

    public AiService(@Qualifier("groqClient") WebClient groqClient,
                     @Qualifier("anthropicClient") WebClient anthropicClient,
                     AppProperties appProperties, ObjectMapper objectMapper,
                     UserRepository userRepository, SubscriptionRepository subscriptionRepository,
                     TransactionRepository transactionRepository, CategoryRepository categoryRepository,
                     AnalyticsService analyticsService, AiProviderResolver resolver) {
        this.groqClient = groqClient;
        this.anthropicClient = anthropicClient;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.userRepository = userRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.categoryRepository = categoryRepository;
        this.analyticsService = analyticsService;
        this.resolver = resolver;
    }

    public String chat(Long userId, AiChatRequest req) {
        var sub = subscriptionRepository.findByUserId(userId).orElseThrow();
        if ("free".equals(sub.getPlan())) {
            throw new BusinessException("AI chat requires a paid plan", HttpStatus.FORBIDDEN);
        }

        User user = userRepository.findById(userId).orElseThrow();
        LocalDate from = req.getFromDate() != null ? req.getFromDate() : LocalDate.now().minusMonths(6);
        LocalDate to = req.getToDate() != null ? req.getToDate() : LocalDate.now();

        var summary = analyticsService.summary(userId, from, to);
        var catBreakdown = analyticsService.categoryBreakdown(userId, from, to);

        String context = """
            Financial context for period %s to %s:
            - Total spent (debits): %s AED
            - Total received (credits): %s AED
            - Net: %s AED
            - Transaction count: %d
            - Top categories: %s
            """.formatted(from, to,
                summary.getTotalDebits(), summary.getTotalCredits(),
                summary.getNet(), summary.getTransactionCount(),
                catBreakdown.stream().limit(5)
                    .map(c -> c.get("category_name") + ": " + c.get("total") + " AED")
                    .toList().toString());

        String systemPrompt = "You are a helpful financial analyst assistant. Answer questions about the user's spending based on the provided data. Be concise and specific. Always mention amounts in AED.";
        String userMessage = context + "\n\nUser question: " + req.getQuestion();

        return callTextAi(user, systemPrompt, userMessage);
    }

    public String suggestCategory(String merchantName, String description,
                                   List<Category> categories, User user) {
        String catList = categories.stream()
                .map(c -> c.getId() + ": " + c.getName())
                .toList().toString();

        String prompt = """
            Given merchant name "%s" and description "%s", which category best fits?
            Available categories: %s

            Respond with JSON only: {"category_id": <id or null>, "suggested_new_category": "<name or null>", "confidence": <0.0-1.0>}
            """.formatted(merchantName, description, catList);

        String response = callTextAi(user, "You are a transaction categorization assistant.", prompt);
        return response.trim();
    }

    private String callTextAi(User user, String systemPrompt, String userMessage) {
        String provider = resolver.resolveTextProvider(user);
        try {
            return switch (provider) {
                case "anthropic" -> callAnthropicText(systemPrompt, userMessage,
                        resolver.resolveAnthropicKey(user), appProperties.getAi().getAnthropicChatModel());
                default -> callGroqText(systemPrompt, userMessage,
                        resolver.resolveGroqKey(user), appProperties.getAi().getGroqChatModel());
            };
        } catch (Exception e) {
            log.error("AI text call failed: {}", e.getMessage());
            throw new BusinessException("AI service temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private String callAnthropicText(String system, String message, String apiKey, String model) {
        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", 1024,
            "system", system,
            "messages", List.of(Map.of("role", "user", "content", message))
        );
        String response = anthropicClient.post().uri("/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body).retrieve().bodyToMono(String.class).block();
        try {
            return objectMapper.readTree(response).path("content").get(0).path("text").asText();
        } catch (Exception e) { throw new RuntimeException("Anthropic parse error", e); }
    }

    private String callGroqText(String system, String message, String apiKey, String model) {
        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", 1024,
            "messages", List.of(
                Map.of("role", "system", "content", system),
                Map.of("role", "user", "content", message)
            )
        );
        String response = groqClient.post().uri("/openai/v1/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body).retrieve().bodyToMono(String.class).block();
        try {
            return objectMapper.readTree(response).path("choices").get(0)
                    .path("message").path("content").asText();
        } catch (Exception e) { throw new RuntimeException("Groq parse error", e); }
    }
}
