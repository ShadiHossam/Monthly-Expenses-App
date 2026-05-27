package com.expensetracker.service;

import com.expensetracker.dto.request.BudgetRequest;
import com.expensetracker.dto.response.BudgetStatusOut;
import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.BudgetAlert;
import com.expensetracker.model.Category;
import com.expensetracker.repository.BudgetAlertRepository;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetAlertRepository budgetAlertRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;

    public List<BudgetAlert> list(Long userId) {
        return budgetAlertRepository.findByUserId(userId);
    }

    @Transactional
    public BudgetAlert create(Long userId, BudgetRequest req) {
        if (budgetAlertRepository.existsByUserIdAndCategoryId(userId, req.getCategoryId())) {
            throw new BusinessException("Budget already exists for this category", HttpStatus.CONFLICT);
        }
        BudgetAlert alert = BudgetAlert.builder()
                .userId(userId)
                .categoryId(req.getCategoryId())
                .monthlyLimit(req.getMonthlyLimit())
                .build();
        return budgetAlertRepository.save(alert);
    }

    @Transactional
    public BudgetAlert update(Long id, Long userId, Map<String, Object> updates) {
        BudgetAlert alert = budgetAlertRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Budget not found"));
        if (updates.containsKey("monthly_limit")) {
            alert.setMonthlyLimit(new BigDecimal(updates.get("monthly_limit").toString()));
        }
        if (updates.containsKey("enabled")) {
            alert.setEnabled((Boolean) updates.get("enabled"));
        }
        return budgetAlertRepository.save(alert);
    }

    @Transactional
    public void delete(Long id, Long userId) {
        BudgetAlert alert = budgetAlertRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Budget not found"));
        budgetAlertRepository.delete(alert);
    }

    public List<BudgetStatusOut> status(Long userId) {
        var cats = categoryRepository.findByUserIdOrderByName(userId)
                .stream().collect(java.util.stream.Collectors.toMap(Category::getId, c -> c));

        return budgetAlertRepository.findByUserId(userId).stream().map(alert -> {
            BigDecimal spent = transactionRepository
                    .sumDebitThisMonthByCategoryNative(userId, alert.getCategoryId());
            if (spent == null) spent = BigDecimal.ZERO;

            double pct = alert.getMonthlyLimit().compareTo(BigDecimal.ZERO) > 0
                    ? spent.divide(alert.getMonthlyLimit(), 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0;

            String status = pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok";
            Category cat = cats.get(alert.getCategoryId());

            List<Object[]> monthly = transactionRepository.monthlyDebitsByCategory(userId, alert.getCategoryId());
            int breachCount = 0;
            String lastBreachMonth = null;
            for (Object[] row : monthly) {
                BigDecimal monthTotal = new BigDecimal(row[1].toString());
                if (monthTotal.compareTo(alert.getMonthlyLimit()) > 0) {
                    breachCount++;
                    lastBreachMonth = row[0].toString();
                }
            }

            return BudgetStatusOut.builder()
                    .id(alert.getId()).categoryId(alert.getCategoryId())
                    .categoryName(cat != null ? cat.getName() : "Unknown")
                    .categoryColor(cat != null ? cat.getColor() : "#9ca3af")
                    .monthlyLimit(alert.getMonthlyLimit())
                    .spentThisMonth(spent)
                    .percentage(Math.round(pct * 10.0) / 10.0)
                    .status(status).enabled(alert.isEnabled())
                    .breachCount(breachCount)
                    .lastBreachMonth(lastBreachMonth)
                    .build();
        }).toList();
    }
}
