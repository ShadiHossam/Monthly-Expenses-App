package com.expensetracker.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class QaAnswerRequest {
    private String merchantName;
    private Long categoryId;
    private List<Long> transactionIds;
    private boolean applyRule;
}
