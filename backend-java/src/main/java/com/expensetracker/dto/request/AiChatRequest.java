package com.expensetracker.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AiChatRequest {
    @NotBlank
    private String question;
    private LocalDate fromDate;
    private LocalDate toDate;
}
