package com.expensetracker.repository;

import com.expensetracker.model.BudgetAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BudgetAlertRepository extends JpaRepository<BudgetAlert, Long> {
    List<BudgetAlert> findByUserId(Long userId);
    Optional<BudgetAlert> findByIdAndUserId(Long id, Long userId);
    boolean existsByUserIdAndCategoryId(Long userId, Long categoryId);
}
