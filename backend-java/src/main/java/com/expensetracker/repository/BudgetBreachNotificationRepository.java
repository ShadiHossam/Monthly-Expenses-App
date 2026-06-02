package com.expensetracker.repository;

import com.expensetracker.model.BudgetBreachNotification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetBreachNotificationRepository extends JpaRepository<BudgetBreachNotification, Long> {
    boolean existsByUserIdAndCategoryIdAndYearAndMonth(Long userId, Long categoryId, int year, int month);
    void deleteByUserId(Long userId);
}
