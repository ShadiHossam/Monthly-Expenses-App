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
    private final TesseractParser tesseractParser;

    public OcrService(@Qualifier("groqClient") WebClient groqClient,
                      @Qualifier("openrouterClient") WebClient openrouterClient,
                      @Qualifier("anthropicClient") WebClient anthropicClient,
                      AppProperties appProperties,
                      ObjectMapper objectMapper,
                      AiProviderResolver resolver,
                      TesseractParser tesseractParser) {
        this.groqClient = groqClient;
        this.openrouterClient = openrouterClient;
        this.anthropicClient = anthropicClient;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.resolver = resolver;
        this.tesseractParser = tesseractParser;
    }

    private static final String EXTRACTION_PROMPT = """
        You are a UAE bank statement parser. Extract ALL transactions from this bank statement image.
        This is likely from a UAE bank (FAB, ADCB, Emirates NBD, Mashreq, DIB, ENBD, RAK Bank, etc.).
        Currency is AED (Arab Emirates Dirham). Amounts may use commas as thousand separators (e.g. 1,234.56).

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
        - amount must be a positive number (strip commas, always positive regardless of type)
        - type must be exactly "debit" (money out) or "credit" (money in)
        - Many UAE statements have SEPARATE Debit and Credit columns — a value in the Debit column means type="debit", Credit column means type="credit"
        - date must be in YYYY-MM-DD format; common formats are DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY
        - balance_after and ref_number can be null if not available
        - description may be in English or Arabic — include as-is, do not translate
        - Include EVERY transaction row visible — do not skip any, even if the description is short
        - Ignore header rows, summary rows, opening/closing balance lines (those are not transactions)
        """;

    public List<TransactionDTO> extract(byte[] imageBytes, String mimeType, User user) {
        String provider = resolver.resolveOcrProvider(user);

        if ("tesseract".equals(provider)) {
            try {
                String rawText = tesseractParser.extractText(imageBytes, mimeType);
                List<TransactionDTO> results = tesseractParser.parse(rawText);
                if (!results.isEmpty()) return results;
                log.warn("Tesseract found 0 transactions, falling back to AI provider");
            } catch (Exception e) {
                log.warn("Tesseract failed ({}), falling back to AI provider", e.getMessage());
            }
            provider = "auto";
        }

        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        AppProperties.Ai ai = appProperties.getAi();

        // Pick the actual provider we'll call so we can fail fast if no key is configured.
        String anthropicKey  = resolver.resolveAnthropicKey(user);
        String groqKey       = resolver.resolveGroqKey(user);
        String openrouterKey = resolver.resolveOpenrouterKey(user);
        String resolvedProvider = provider;
        if (!"anthropic".equals(provider) && !"groq".equals(provider) && !"openrouter".equals(provider)) {
            if (org.springframework.util.StringUtils.hasText(openrouterKey)) resolvedProvider = "openrouter";
            else if (org.springframework.util.StringUtils.hasText(groqKey))  resolvedProvider = "groq";
            else if (org.springframework.util.StringUtils.hasText(anthropicKey)) resolvedProvider = "anthropic";
            else throw new RuntimeException("No AI provider configured — set GROQ_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY in your environment (or add a key in user AI settings)");
        }
        log.info("OCR using provider={} (max-retries={})", resolvedProvider, ai.getMaxRetries());

        for (int attempt = 0; attempt <= ai.getMaxRetries(); attempt++) {
            try {
                String jsonResponse = switch (resolvedProvider) {
                    case "anthropic"  -> callAnthropic(base64, mimeType, anthropicKey, ai.getAnthropicOcrModel());
                    case "groq"       -> callGroq(base64, mimeType, groqKey, ai.getGroqOcrModel());
                    case "openrouter" -> callOpenRouter(base64, mimeType, openrouterKey, ai.getOpenrouterOcrModel());
                    default -> throw new IllegalStateException("Unreachable provider: " + resolvedProvider);
                };
                List<TransactionDTO> parsed = parseTransactions(jsonResponse);
                log.info("OCR extracted {} transactions via {}", parsed.size(), resolvedProvider);
                return parsed;
            } catch (org.springframework.web.reactive.function.client.WebClientResponseException e) {
                log.warn("OCR attempt {} failed ({}): {} — body: {}",
                        attempt + 1, resolvedProvider, e.getMessage(), e.getResponseBodyAsString());
                if (attempt == ai.getMaxRetries()) {
                    throw new RuntimeException("OCR via " + resolvedProvider + " failed: " + e.getMessage(), e);
                }
            } catch (Exception e) {
                log.warn("OCR attempt {} failed ({}): {}", attempt + 1, resolvedProvider, e.getMessage());
                if (attempt == ai.getMaxRetries()) {
                    throw new RuntimeException("OCR via " + resolvedProvider + " failed: " + e.getMessage(), e);
                }
            }
        }
        // Defensive — shouldn't reach here because the last attempt throws.
        throw new RuntimeException("OCR via " + resolvedProvider + " failed after " + (ai.getMaxRetries() + 1) + " attempts");
    }

    private String callAnthropic(String base64, String mimeType, String apiKey, String model) {
        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", 8192,
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
            "max_tokens", 8192,
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
            "max_tokens", 8192,
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
            // strip markdown fences (handles ```json, ```JSON, plain ```)
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("(?s)```[a-zA-Z]*\\n?", "").replace("```", "").trim();
            }
            // extract bare JSON array — skip any preamble or postamble text the AI added
            int start = cleaned.indexOf('[');
            int end   = cleaned.lastIndexOf(']');
            if (start >= 0 && end > start) cleaned = cleaned.substring(start, end + 1);
            return objectMapper.readValue(cleaned, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Failed to parse transaction JSON from AI response: {}", jsonText);
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
            if (date == null || date.isBlank())
                throw new java.time.format.DateTimeParseException("blank date", "", 0);
            List<java.time.format.DateTimeFormatter> fmts = List.of(
                java.time.format.DateTimeFormatter.ISO_LOCAL_DATE,                                          // 2026-05-29
                java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"),                                 // 29/05/2026
                java.time.format.DateTimeFormatter.ofPattern("d/M/yyyy"),                                   // 9/5/2026
                java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy"),                                 // 29-05-2026
                java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy", java.util.Locale.ENGLISH),     // 29 May 2026
                java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy",  java.util.Locale.ENGLISH),     //  9 May 2026
                java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy")                                  // 05/29/2026
            );
            for (var fmt : fmts) {
                try { return LocalDate.parse(date, fmt); } catch (Exception ignored) {}
            }
            throw new java.time.format.DateTimeParseException("Cannot parse date: " + date, date, 0);
        }
    }
}
