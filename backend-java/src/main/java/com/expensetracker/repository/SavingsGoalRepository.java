package com.expensetracker.repository;

import com.expensetracker.model.SavingsGoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, Long> {
    List<SavingsGoal> findByUserIdOrderByTargetDateAsc(Long userId);
    void deleteByUserId(Long userId);
}
