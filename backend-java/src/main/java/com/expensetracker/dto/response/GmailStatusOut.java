package com.expensetracker.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class GmailStatusOut {
    private boolean connected;
    private String gmailEmail;
    private String syncDays;
    private List<SenderOut> senders;

    @Data
    @Builder
    public static class SenderOut {
        private Long id;
        private String senderEmail;
    }
}
