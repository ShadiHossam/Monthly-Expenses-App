package com.expensetracker.service;

import com.expensetracker.model.User;
import com.expensetracker.repository.StatementRepository;
import com.expensetracker.repository.TransactionRepository;
import com.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final StatementRepository statementRepository;

    public Map<String, Object> getStats() {
        OffsetDateTime weekAgo = OffsetDateTime.now().minusWeeks(1);
        OffsetDateTime thirtyDaysAgo = OffsetDateTime.now().minusDays(30);

        long totalUsers = userRepository.count();
        long totalTransactions = transactionRepository.count();
        long totalStatements = statementRepository.count();
        long newUsersThisWeek = userRepository.countByCreatedAtAfter(weekAgo);

        List<Object[]> rawSignups = userRepository.signupsPerDaySince(thirtyDaysAgo);
        List<Map<String, Object>> signupsLast30Days = new ArrayList<>();
        for (Object[] row : rawSignups) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("date", row[0].toString());
            entry.put("count", ((Number) row[1]).longValue());
            signupsLast30Days.add(entry);
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("totalTransactions", totalTransactions);
        stats.put("totalStatements", totalStatements);
        stats.put("newUsersThisWeek", newUsersThisWeek);
        stats.put("signupsLast30Days", signupsLast30Days);
        return stats;
    }

    public List<Map<String, Object>> getUsers() {
        List<User> users = userRepository.findAll(
                org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));

        List<Map<String, Object>> result = new ArrayList<>();
        for (User user : users) {
            long txnCount = transactionRepository.countByUserId(user.getId());
            long stmtCount = statementRepository.countByUserId(user.getId());
            Map<String, Object> row = new HashMap<>();
            row.put("id", user.getId());
            row.put("username", user.getUsername());
            row.put("email", user.getEmail());
            row.put("createdAt", user.getCreatedAt());
            row.put("role", user.getRole());
            row.put("transactionCount", txnCount);
            row.put("statementCount", stmtCount);
            result.add(row);
        }
        return result;
    }
}
