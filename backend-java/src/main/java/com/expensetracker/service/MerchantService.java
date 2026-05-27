package com.expensetracker.service;

import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.MerchantAlias;
import com.expensetracker.model.MerchantRule;
import com.expensetracker.model.Transaction;
import com.expensetracker.repository.MerchantAliasRepository;
import com.expensetracker.repository.MerchantRuleRepository;
import com.expensetracker.repository.TransactionRepository;
import com.expensetracker.dto.request.MerchantRuleRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class MerchantService {

    private final MerchantRuleRepository merchantRuleRepository;
    private final MerchantAliasRepository merchantAliasRepository;
    private final TransactionRepository transactionRepository;

    public List<MerchantRule> listRules(Long userId) {
        return merchantRuleRepository.findByUserIdOrderByPriorityDesc(userId);
    }

    @Transactional
    public MerchantRule createRule(Long userId, MerchantRuleRequest req) {
        MerchantRule rule = MerchantRule.builder()
                .userId(userId)
                .pattern(req.getPattern())
                .patternType(req.getPatternType())
                .categoryId(req.getCategoryId())
                .priority(req.getPriority())
                .build();
        return merchantRuleRepository.save(rule);
    }

    @Transactional
    public MerchantRule updateRule(Long id, Long userId, MerchantRuleRequest req) {
        MerchantRule rule = merchantRuleRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Rule not found"));
        rule.setPattern(req.getPattern());
        rule.setPatternType(req.getPatternType());
        rule.setCategoryId(req.getCategoryId());
        rule.setPriority(req.getPriority());
        return merchantRuleRepository.save(rule);
    }

    @Transactional
    public void deleteRule(Long id, Long userId) {
        MerchantRule rule = merchantRuleRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Rule not found"));
        merchantRuleRepository.delete(rule);
    }

    public boolean testRule(String pattern, String patternType, String sampleText) {
        return matches(pattern, patternType, sampleText);
    }

    public void applyMerchantRules(List<Transaction> transactions, Long userId) {
        List<MerchantRule> rules = merchantRuleRepository.findByUserIdOrderByPriorityDesc(userId);
        for (Transaction tx : transactions) {
            String name = tx.getMerchantName() != null ? tx.getMerchantName() : tx.getDescription();
            for (MerchantRule rule : rules) {
                if (matches(rule.getPattern(), rule.getPatternType(), name)) {
                    tx.setCategoryId(rule.getCategoryId());
                    tx.setCategorized(true);
                    break;
                }
            }
        }
    }

    private boolean matches(String pattern, String patternType, String text) {
        if (text == null || pattern == null) return false;
        return switch (patternType != null ? patternType : "contains") {
            case "startswith" -> text.toLowerCase().startsWith(pattern.toLowerCase());
            case "regex" -> {
                try { yield Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(text).find(); }
                catch (Exception e) { yield false; }
            }
            default -> text.toLowerCase().contains(pattern.toLowerCase()); // contains
        };
    }

    public List<MerchantAlias> listAliases(Long userId) {
        return merchantAliasRepository.findByUserId(userId);
    }

    @Transactional
    public MerchantAlias createAlias(Long userId, String rawName, String displayName) {
        MerchantAlias alias = MerchantAlias.builder()
                .userId(userId).rawName(rawName).displayName(displayName).build();
        return merchantAliasRepository.save(alias);
    }

    @Transactional
    public void deleteAlias(Long id, Long userId) {
        MerchantAlias alias = merchantAliasRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Alias not found"));
        merchantAliasRepository.delete(alias);
    }

    public List<Map<String, Object>> listMerchants(Long userId) {
        return dbAggregateMerchants(userId, java.time.LocalDate.of(2000, 1, 1), java.time.LocalDate.now(), 500);
    }

    public List<Map<String, Object>> frequentMerchants(Long userId) {
        return transactionRepository.aggregateMerchants(
                        userId, java.time.LocalDate.now().minusMonths(3), java.time.LocalDate.now(), 20)
                .stream()
                .filter(row -> ((Number) row[1]).intValue() >= 2)
                .map(row -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("merchant_name", row[0]);
                    m.put("visit_count", ((Number) row[1]).intValue());
                    m.put("total_spent", row[2]);
                    m.put("avg_spend", row[3]);
                    m.put("frequency_reason", "frequent");
                    return m;
                }).toList();
    }

    public List<Map<String, Object>> ranking(Long userId, int limit) {
        var rows = transactionRepository.aggregateMerchants(
                        userId, java.time.LocalDate.of(2000, 1, 1), java.time.LocalDate.now(), limit)
                .stream()
                .map(row -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("merchant_name", row[0]);
                    m.put("visit_count", ((Number) row[1]).intValue());
                    m.put("total_spend", row[2]);
                    m.put("avg_spend", row[3]);
                    return m;
                })
                .sorted((a, b) -> new java.math.BigDecimal(b.get("total_spend").toString())
                        .compareTo(new java.math.BigDecimal(a.get("total_spend").toString())))
                .toList();
        var result = new java.util.ArrayList<Map<String, Object>>();
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> m = new java.util.LinkedHashMap<>(rows.get(i));
            m.put("rank", i + 1);
            result.add(m);
        }
        return result;
    }

    public List<Map<String, Object>> merchantTransactions(Long userId, String merchantName) {
        return transactionRepository.findByUserIdAndDateRange(
                        userId, java.time.LocalDate.of(2000, 1, 1), java.time.LocalDate.now())
                .stream()
                .filter(t -> merchantName.equalsIgnoreCase(t.getMerchantName())
                        || merchantName.equalsIgnoreCase(t.getDescription()))
                .map(t -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", t.getId());
                    m.put("txn_date", t.getTxnDate());
                    m.put("description", t.getDescription());
                    m.put("amount", t.getAmount());
                    m.put("txn_type", t.getTxnType());
                    m.put("category_id", t.getCategoryId());
                    return m;
                }).toList();
    }

    private List<Map<String, Object>> dbAggregateMerchants(Long userId, java.time.LocalDate from,
                                                           java.time.LocalDate to, int limit) {
        return transactionRepository.aggregateMerchants(userId, from, to, limit)
                .stream()
                .map(row -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("merchant_name", row[0]);
                    m.put("visit_count", ((Number) row[1]).intValue());
                    m.put("total_spend", row[2]);
                    m.put("avg_spend", row[3]);
                    return m;
                }).toList();
    }
}
