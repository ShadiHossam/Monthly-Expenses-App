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
            BigDecimal net = credits.subtract(debits).max(BigDecimal.ZERO);
            double pct = goal.getTargetAmount().compareTo(BigDecimal.ZERO) > 0
                ? Math.min(net.doubleValue() / goal.getTargetAmount().doubleValue() * 100, 100) : 0;

            return Map.<String, Object>of(
                "id", goal.getId(),
                "name", goal.getName(),
                "target_amount", goal.getTargetAmount(),
                "target_date", goal.getTargetDate().toString(),
                "color", goal.getColor(),
                "net_saved", net,
                "progress_pct", Math.round(pct * 10.0) / 10.0
            );
        }).toList();
    }

    @Transactional
    public SavingsGoal create(Long userId, Map<String, Object> body) {
        if (body.get("name") == null || body.get("targetAmount") == null || body.get("targetDate") == null) {
            throw new BusinessException("name, targetAmount, and targetDate are required", HttpStatus.BAD_REQUEST);
        }
        return repo.save(SavingsGoal.builder()
            .userId(userId)
            .name(body.get("name").toString())
            .targetAmount(new BigDecimal(body.get("targetAmount").toString()))
            .targetDate(LocalDate.parse(body.get("targetDate").toString()))
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
