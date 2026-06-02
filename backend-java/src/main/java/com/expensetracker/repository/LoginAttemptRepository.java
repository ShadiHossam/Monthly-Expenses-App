package com.expensetracker.repository;

import com.expensetracker.model.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {
    Optional<LoginAttempt> findByIp(String ip);

    @Modifying
    @Query("DELETE FROM LoginAttempt la WHERE la.windowStart < :cutoff")
    void deleteOlderThan(@Param("cutoff") Instant cutoff);
}
