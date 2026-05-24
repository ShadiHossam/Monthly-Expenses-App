package com.expensetracker.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class SaveReportRequest {
    @NotBlank
    private String name;
    @NotNull
    private LocalDate fromDate;
    @NotNull
    private LocalDate toDate;
}
