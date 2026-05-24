package com.expensetracker.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MerchantRuleRequest {
    @NotBlank
    private String pattern;
    private String patternType = "contains";
    @NotNull
    private Long categoryId;
    private int priority = 0;
}
