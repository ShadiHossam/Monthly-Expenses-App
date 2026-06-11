package com.expensetracker.repository;

import com.expensetracker.model.GmailProcessedMessage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GmailProcessedMessageRepository extends JpaRepository<GmailProcessedMessage, Long> {
    boolean existsByUserIdAndGmailMessageId(Long userId, String gmailMessageId);
}
