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
    private int breachCount;       // # of past months (excl. current) where spending > limit
    private String lastBreachMonth; // most recent breached month as YYYY-MM, null if none
}
