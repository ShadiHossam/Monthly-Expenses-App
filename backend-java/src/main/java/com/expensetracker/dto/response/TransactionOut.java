package com.expensetracker.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@Builder
public class TransactionOut {
    private Long id;
    private Long userId;
    private Long statementId;
    private LocalDate txnDate;
    private String refNumber;
    private String description;
    private String merchantName;
    private BigDecimal amount;
    private String txnType;
    private BigDecimal balanceAfter;
    private Long categoryId;
    private String categoryName;
    private String categoryColor;
    private String categoryIcon;
    private boolean isCategorized;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime createdAt;
}
