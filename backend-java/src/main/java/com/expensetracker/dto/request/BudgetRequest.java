package com.expensetracker.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class BudgetRequest {
    @NotNull
    private Long categoryId;
    @NotNull
    @Positive
    private BigDecimal monthlyLimit;
}
