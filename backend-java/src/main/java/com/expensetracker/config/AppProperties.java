package com.expensetracker.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "app")
@Data
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private Upload upload = new Upload();
    private Stripe stripe = new Stripe();
    private Ai ai = new Ai();
    private boolean allowRegistration = true;

    @Data
    public static class Jwt {
        private String secret;
        private int expiryDays = 30;
    }

    @Data
    public static class Cors {
        private String origins = "http://localhost:5173";
    }

    @Data
    public static class Upload {
        private String dir = "/app/data/uploads";
    }

    @Data
    public static class Stripe {
        private String secretKey = "";
        private String webhookSecret = "";
        private String priceSolo = "";
        private String pricePro = "";
        private String priceBusiness = "";
        private String priceOverage = "";
    }

    @Data
    public static class Ai {
        private String groqApiKey = "";
        private String openrouterApiKey = "";
        private String anthropicApiKey = "";
        private int maxRetries = 2;
        // Model names — override via env/config to avoid redeployment
        private String anthropicOcrModel = "claude-haiku-4-5-20251001";
        private String groqOcrModel = "meta-llama/llama-4-scout-17b-16e-instruct";
        private String openrouterOcrModel = "google/gemini-2.0-flash-exp:free";
        private String anthropicChatModel = "claude-haiku-4-5-20251001";
        private String groqChatModel = "llama-3.3-70b-versatile";
    }

    public List<String> getCorsOriginsList() {
        return List.of(cors.getOrigins().split(","));
    }
}
