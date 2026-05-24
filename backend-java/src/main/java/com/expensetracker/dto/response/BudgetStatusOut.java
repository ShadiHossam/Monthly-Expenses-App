package com.expensetracker.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BudgetStatusOut {
    private Long id;
    private Long categoryId;
    private String categoryName;
    private String categoryColor;
    private BigDecimal monthlyLimit;
    private BigDecimal spentThisMonth;
    private double percentage;
    private String status; // ok / warning / exceeded
    private boolean enabled;
}
