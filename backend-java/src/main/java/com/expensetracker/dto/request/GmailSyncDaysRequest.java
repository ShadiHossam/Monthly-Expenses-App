package com.expensetracker.dto.request;

import lombok.Data;

@Data
public class GmailSyncDaysRequest {
    /** Comma-separated day numbers, e.g. "1,2,3,28,29,30,31" */
    private String syncDays;
}
