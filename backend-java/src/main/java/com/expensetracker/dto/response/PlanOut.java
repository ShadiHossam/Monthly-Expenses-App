package com.expensetracker.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PlanOut {
    private String key;
    private String label;
    private double priceUsd;
    private int pages;
    private int concurrent;
    private boolean overage;
    private double overagePriceUsd;
    private boolean aiChat;
    private int trialDays;
    private List<String> features;
}
