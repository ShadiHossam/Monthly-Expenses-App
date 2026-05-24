package com.expensetracker.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;

@Data
@Builder
public class BillingUsage {
    private String plan;
    private String planLabel;
    private String status;
    private int pagesUsed;
    private int pagesLimit;
    private int pagesRemaining;
    private boolean overageEnabled;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime currentPeriodStart;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime currentPeriodEnd;
    private List<UsageLogOut> usageLogs;
}
