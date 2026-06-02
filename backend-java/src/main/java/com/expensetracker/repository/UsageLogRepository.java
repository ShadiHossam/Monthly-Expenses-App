package com.expensetracker.repository;

import com.expensetracker.model.UsageLog;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface UsageLogRepository extends JpaRepository<UsageLog, Long> {
    List<UsageLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    List<UsageLog> findByUserIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            Long userId, OffsetDateTime from, OffsetDateTime to);
    void deleteByUserId(Long userId);
}
