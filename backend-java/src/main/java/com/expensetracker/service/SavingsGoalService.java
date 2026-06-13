package com.expensetracker.service;

import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.SavingsGoal;
import com.expensetracker.repository.SavingsGoalRepository;
import com.expensetracker.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SavingsGoalService {

    private final SavingsGoalRepository repo;
    private final TransactionRepository transactionRepository;

    public List<Map<String, Object>> listWithProgress(Long userId) {
        return repo.findByUserIdOrderByTargetDateAsc(userId).stream().map(goal -> {
            LocalDate from = goal.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            LocalDate to = LocalDate.now();
            BigDecimal credits = transactionRepository.sumCreditsBetween(userId, from, to).orElse(BigDecimal.ZERO);
            BigDecimal debits  = transactionRepository.sumDebitsBetween(userId, from, to).orElse(BigDecimal.ZERO);
            BigDecimal netIncome = credits.subtract(debits);          // raw; can be negative
            BigDecimal netSaved  = netIncome.max(BigDecimal.ZERO);    // clamped for progress bar
            double pct = goal.getTargetAmount().compareTo(BigDecimal.ZERO) > 0
                ? Math.min(netSaved.doubleValue() / goal.getTargetAmount().doubleValue() * 100, 100) : 0;

            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", goal.getId());
            m.put("name", goal.getName());
            m.put("target_amount", goal.getTargetAmount());
            m.put("target_date", goal.getTargetDate().toString());
            m.put("color", goal.getColor());
            m.put("net_income", netIncome);   // raw signed value — negative means overspending
            m.put("net_saved", netSaved);     // clamped ≥ 0 for progress display
            m.put("progress_pct", Math.round(pct * 10.0) / 10.0);
            return m;
        }).toList();
    }

    @Transactional
    public SavingsGoal create(Long userId, Map<String, Object> body) {
        if (body.get("name") == null || body.get("targetAmount") == null || body.get("targetDate") == null) {
            throw new BusinessException("name, targetAmount, and targetDate are required", HttpStatus.BAD_REQUEST);
        }
        BigDecimal targetAmount;
        LocalDate targetDate;
        try {
            targetAmount = new BigDecimal(body.get("targetAmount").toString());
        } catch (NumberFormatException e) {
            throw new BusinessException("targetAmount must be a valid number", HttpStatus.BAD_REQUEST);
        }
        try {
            targetDate = LocalDate.parse(body.get("targetDate").toString());
        } catch (java.time.format.DateTimeParseException e) {
            throw new BusinessException("targetDate must be in YYYY-MM-DD format", HttpStatus.BAD_REQUEST);
        }
        return repo.save(SavingsGoal.builder()
            .userId(userId)
            .name(body.get("name").toString())
            .targetAmount(targetAmount)
            .targetDate(targetDate)
            .color(body.getOrDefault("color", "#10b981").toString())
            .build());
    }

    @Transactional
    public void delete(Long id, Long userId) {
        SavingsGoal goal = repo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Goal not found"));
        if (!goal.getUserId().equals(userId)) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
        repo.delete(goal);
    }
}
