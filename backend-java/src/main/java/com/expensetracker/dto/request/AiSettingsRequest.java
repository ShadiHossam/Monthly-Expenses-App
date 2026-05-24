package com.expensetracker.dto.request;

import lombok.Data;

@Data
public class AiSettingsRequest {
    private String groqApiKey;
    private String openrouterApiKey;
    private String anthropicApiKey;
    private String aiProvider;
    private Integer concurrentProcessing;
}
