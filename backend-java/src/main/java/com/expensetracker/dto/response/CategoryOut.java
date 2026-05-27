package com.expensetracker.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class CategoryOut {
    private Long id;
    private Long userId;
    private String name;
    private String color;
    private String icon;
    @JsonProperty("is_system")
    private boolean isSystem;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime createdAt;
    private long transactionCount;
}
