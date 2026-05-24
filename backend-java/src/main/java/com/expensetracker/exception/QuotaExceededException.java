package com.expensetracker.exception;

import lombok.Getter;

@Getter
public class QuotaExceededException extends RuntimeException {
    private final boolean overageAvailable;

    public QuotaExceededException(String message, boolean overageAvailable) {
        super(message);
        this.overageAvailable = overageAvailable;
    }
}
