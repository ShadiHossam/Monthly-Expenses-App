package com.expensetracker.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class BulkCategorizeRequest {
    @NotNull
    private Long categoryId;
    @NotEmpty
    private List<Long> transactionIds;
}
