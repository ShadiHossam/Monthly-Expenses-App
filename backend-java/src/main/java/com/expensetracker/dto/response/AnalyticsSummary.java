package com.expensetracker.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class AnalyticsSummary {
    private BigDecimal totalDebits;
    private BigDecimal totalCredits;
    private BigDecimal net;
    private BigDecimal openingBalance;
    private BigDecimal closingBalance;
    private long transactionCount;
    private BiggestExpense biggestExpense;

    @Data
    @Builder
    public static class BiggestExpense {
        private String merchantName;
        private BigDecimal amount;
        private LocalDate date;
    }
}
