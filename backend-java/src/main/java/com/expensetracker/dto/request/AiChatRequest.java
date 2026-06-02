package com.expensetracker.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AiChatRequest {
    @NotBlank
    @Size(max = 500, message = "Question must not exceed 500 characters")
    private String question;
    private LocalDate fromDate;
    private LocalDate toDate;
}
