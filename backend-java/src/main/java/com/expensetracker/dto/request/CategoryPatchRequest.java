package com.expensetracker.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CategoryPatchRequest {
    @NotNull(message = "category_id is required")
    private Long categoryId;
}
