package com.expensetracker.repository;

import com.expensetracker.model.GmailOauthState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.Optional;

public interface GmailOauthStateRepository extends JpaRepository<GmailOauthState, String> {
    Optional<GmailOauthState> findByStateAndExpiresAtAfter(String state, OffsetDateTime now);

    @Transactional
    @Modifying
    void deleteByExpiresAtBefore(OffsetDateTime cutoff);
}
