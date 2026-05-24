package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.model.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class OcrService {

    private final WebClient groqClient;
    private final WebClient openrouterClient;
    private final WebClient anthropicClient;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final AiProviderResolver resolver;

    public OcrService(@Qualifier("groqClient") WebClient groqClient,
                      @Qualifier("openrouterClient") WebClient openrouterClient,
                      @Qualifier("anthropicClient") WebClient anthropicClient,
                      AppProperties appProperties,
                      ObjectMapper objectMapper,
                      AiProviderResolver resolver) {
        this.groqClient = groqClient;
        this.openrouterClient = openrouterClient;
        this.anthropicClient = anthropicClient;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.resolver = resolver;
    }

    private static final String EXTRACTION_PROMPT = """
        You are a bank statement parser. Extract all transactions from this bank statement image.
        Return ONLY a JSON array (no markdown, no explanation) with this exact structure:
        [
          {
            "date": "YYYY-MM-DD",
            "description": "transaction description",
            "amount": 123.45,
            "type": "debit",
            "balance_after": 1000.00,
            "ref_number": "REF123"
          }
        ]
        Rules:
        - amount must be a positive number
        - type must be exactly "debit" or "credit"
        - date must be in YYYY-MM-DD format
        - balance_after and ref_number can be null if not available
        - Include ALL transactions visible in the image
        """;

    public List<TransactionDTO> extract(byte[] imageBytes, String mimeType, User user) {
        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        String provider = resolver.resolveOcrProvider(user);
        AppProperties.Ai ai = appProperties.getAi();

        for (int attempt = 0; attempt <= ai.getMaxRetries(); attempt++) {
            try {
                String jsonResponse = switch (provider) {
                    case "anthropic" -> callAnthropic(base64, mimeType,
                            resolver.resolveAnthropicKey(user), ai.getAnthropicOcrModel());
                    case "groq" -> callGroq(base64, mimeType,
                            resolver.resolveGroqKey(user), ai.getGroqOcrModel());
                    default -> {
                        String openrouterKey = resolver.resolveOpenrouterKey(user);
                        if (org.springframework.util.StringUtils.hasText(openrouterKey)) {
                            yield callOpenRouter(base64, mimeType, openrouterKey, ai.getOpenrouterOcrModel());
                        } else if (org.springframework.util.StringUtils.hasText(resolver.resolveGroqKey(user))) {
                            yield callGroq(base64, mimeType, resolver.resolveGroqKey(user), ai.getGroqOcrModel());
                        } else {
                            yield callAnthropic(base64, mimeType, resolver.resolveAnthropicKey(user), ai.getAnthropicOcrModel());
                        }
                    }
                };
                return parseTransactions(jsonResponse);
            } catch (Exception e) {
                log.warn("OCR attempt {} failed: {}", attempt + 1, e.getMessage());
                if (attempt == ai.getMaxRetries()) {
                    throw new RuntimeException("Failed to extract transactions after retries", e);
                }
            }
        }
        return List.of();
    }

    private String callAnthropic(String base64, String mimeType, String apiKey, String model) {
        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", 4096,
            "messages", List.of(Map.of(
                "role", "user",
                "content", List.of(
                    Map.of("type", "image", "source", Map.of(
                        "type", "base64",
                        "media_type", mimeType,
                        "data", base64
                    )),
                    Map.of("type", "text", "text", EXTRACTION_PROMPT)
                )
            ))
        );

        String response = anthropicClient.post()
                .uri("/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        try {
            JsonNode root = objectMapper.readTree(response);
            return root.path("content").get(0).path("text").asText();
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Anthropic response", e);
        }
    }

    private String callGroq(String base64, String mimeType, String apiKey, String model) {
        String dataUri = "data:" + mimeType + ";base64," + base64;
        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", 4096,
            "messages", List.of(Map.of(
                "role", "user",
                "content", List.of(
                    Map.of("type", "image_url", "image_url", Map.of("url", dataUri)),
                    Map.of("type", "text", "text", EXTRACTION_PROMPT)
                )
            ))
        );

        String response = groqClient.post()
                .uri("/openai/v1/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        return extractOpenAiContent(response);
    }

    private String callOpenRouter(String base64, String mimeType, String apiKey, String model) {
        String dataUri = "data:" + mimeType + ";base64," + base64;
        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", 4096,
            "messages", List.of(Map.of(
                "role", "user",
                "content", List.of(
                    Map.of("type", "image_url", "image_url", Map.of("url", dataUri)),
                    Map.of("type", "text", "text", EXTRACTION_PROMPT)
                )
            ))
        );

        String response = openrouterClient.post()
                .uri("/api/v1/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        return extractOpenAiContent(response);
    }

    private String extractOpenAiContent(String response) {
        try {
            JsonNode root = objectMapper.readTree(response);
            return root.path("choices").get(0).path("message").path("content").asText();
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse AI response", e);
        }
    }

    private List<TransactionDTO> parseTransactions(String jsonText) {
        try {
            String cleaned = jsonText.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("```json\\n?|```", "").trim();
            }
            return objectMapper.readValue(cleaned, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Failed to parse transaction JSON: {}", jsonText);
            throw new RuntimeException("Could not parse extracted transactions", e);
        }
    }

    public record TransactionDTO(
            String date,
            String description,
            BigDecimal amount,
            String type,
            BigDecimal balance_after,
            String ref_number
    ) {
        public LocalDate parsedDate() {
            return LocalDate.parse(date);
        }
    }
}
