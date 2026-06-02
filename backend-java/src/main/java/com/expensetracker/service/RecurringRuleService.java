package com.expensetracker.service;

import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.RecurringRule;
import com.expensetracker.repository.RecurringRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecurringRuleService {

    private final RecurringRuleRepository repo;

    public List<RecurringRule> list(Long userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public RecurringRule create(Long userId, Map<String, Object> body) {
        String label = (String) body.get("label");
        if (label == null || label.isBlank()) {
            throw new BusinessException("Label is required", HttpStatus.BAD_REQUEST);
        }
        return repo.save(RecurringRule.builder()
            .userId(userId)
            .label(label.trim())
            .merchantPattern(body.get("merchantPattern") != null ? (String) body.get("merchantPattern") : null)
            .expectedAmount(body.get("expectedAmount") != null
                ? new BigDecimal(body.get("expectedAmount").toString()) : null)
            .frequencyDays(body.get("frequencyDays") != null
                ? Integer.parseInt(body.get("frequencyDays").toString()) : 30)
            .nextExpectedDate(body.get("nextExpectedDate") != null
                ? LocalDate.parse((String) body.get("nextExpectedDate")) : null)
            .build());
    }

    @Transactional
    public RecurringRule update(Long id, Long userId, Map<String, Object> body) {
        RecurringRule rule = repo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Recurring rule not found"));
        if (!rule.getUserId().equals(userId)) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
        if (body.containsKey("label") && body.get("label") != null) {
            rule.setLabel(body.get("label").toString());
        }
        if (body.containsKey("active")) {
            rule.setActive((Boolean) body.get("active"));
        }
        if (body.containsKey("expectedAmount") && body.get("expectedAmount") != null) {
            rule.setExpectedAmount(new BigDecimal(body.get("expectedAmount").toString()));
        }
        if (body.containsKey("nextExpectedDate") && body.get("nextExpectedDate") != null) {
            rule.setNextExpectedDate(LocalDate.parse((String) body.get("nextExpectedDate")));
        }
        return repo.save(rule);
    }

    @Transactional
    public void delete(Long id, Long userId) {
        RecurringRule rule = repo.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Recurring rule not found"));
        if (!rule.getUserId().equals(userId)) {
            throw new BusinessException("Access denied", HttpStatus.FORBIDDEN);
        }
        repo.delete(rule);
    }
}
