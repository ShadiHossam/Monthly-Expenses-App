package com.expensetracker.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@Builder
public class StatementOut {
    private Long id;
    private Long userId;
    private String filename;
    private String imagePath;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private BigDecimal openingBalance;
    private BigDecimal closingBalance;
    private String verifyStatus;
    private String verifyErrors;
    private Double confidence;
    private String ocrEngine;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime createdAt;
    private long transactionCount;
}
