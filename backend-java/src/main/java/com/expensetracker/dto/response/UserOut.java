package com.expensetracker.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class UserOut {
    private Long id;
    private String username;
    private String email;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime createdAt;
    private boolean groqApiKeySet;
    private boolean openrouterApiKeySet;
    private boolean anthropicApiKeySet;
    private String aiProvider;
    private int concurrentProcessing;
}
