package com.expensetracker.repository;

import com.expensetracker.model.GmailFilterSender;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface GmailFilterSenderRepository extends JpaRepository<GmailFilterSender, Long> {
    List<GmailFilterSender> findByUserId(Long userId);

    @Transactional
    @Modifying
    void deleteByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndSenderEmail(Long userId, String senderEmail);
}
