package com.expensetracker.repository;

import com.expensetracker.model.RecurringRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecurringRuleRepository extends JpaRepository<RecurringRule, Long> {
    List<RecurringRule> findByUserIdOrderByCreatedAtDesc(Long userId);
    void deleteByUserId(Long userId);
}
