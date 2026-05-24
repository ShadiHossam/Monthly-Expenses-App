package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AiProviderResolver {

    private final AppProperties appProperties;

    public String resolveOcrProvider(User user) {
        String p = user.getAiProvider();
        if ("anthropic".equals(p) && StringUtils.hasText(user.getAnthropicApiKey())) return "anthropic";
        if ("groq".equals(p) && StringUtils.hasText(user.getGroqApiKey())) return "groq";
        if ("openrouter".equals(p) && StringUtils.hasText(user.getOpenrouterApiKey())) return "openrouter";
        return "auto";
    }

    public String resolveTextProvider(User user) {
        String p = user.getAiProvider();
        if ("anthropic".equals(p) && StringUtils.hasText(user.getAnthropicApiKey())) return "anthropic";
        if (StringUtils.hasText(resolveGroqKey(user))) return "groq";
        return "anthropic";
    }

    public String resolveGroqKey(User user) {
        return StringUtils.hasText(user.getGroqApiKey())
                ? user.getGroqApiKey() : appProperties.getAi().getGroqApiKey();
    }

    public String resolveOpenrouterKey(User user) {
        return StringUtils.hasText(user.getOpenrouterApiKey())
                ? user.getOpenrouterApiKey() : appProperties.getAi().getOpenrouterApiKey();
    }

    public String resolveAnthropicKey(User user) {
        return StringUtils.hasText(user.getAnthropicApiKey())
                ? user.getAnthropicApiKey() : appProperties.getAi().getAnthropicApiKey();
    }
}
