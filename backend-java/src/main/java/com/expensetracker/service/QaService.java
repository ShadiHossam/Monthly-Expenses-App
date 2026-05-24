package com.expensetracker.service;

import com.expensetracker.dto.request.QaAnswerRequest;
import com.expensetracker.model.Category;
import com.expensetracker.model.MerchantRule;
import com.expensetracker.model.Transaction;
import com.expensetracker.model.User;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.MerchantRuleRepository;
import com.expensetracker.repository.TransactionRepository;
import com.expensetracker.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.stream.Collectors;

@Service
@Slf4j
public class QaService {

    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;
    private final MerchantRuleRepository merchantRuleRepository;
    private final UserRepository userRepository;
    private final AiService aiService;
    private final ObjectMapper objectMapper;
    private final ExecutorService qaExecutor;

    public QaService(TransactionRepository transactionRepository,
                     CategoryRepository categoryRepository,
                     MerchantRuleRepository merchantRuleRepository,
                     UserRepository userRepository,
                     AiService aiService,
                     ObjectMapper objectMapper,
                     @org.springframework.beans.factory.annotation.Qualifier("qaExecutor") ExecutorService qaExecutor) {
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.merchantRuleRepository = merchantRuleRepository;
        this.userRepository = userRepository;
        this.aiService = aiService;
        this.objectMapper = objectMapper;
        this.qaExecutor = qaExecutor;
    }

    public List<Map<String, Object>> pending(Long userId, Long statementId) {
        List<Transaction> uncategorized = statementId != null
                ? transactionRepository.findByStatementIdAndUserId(statementId, userId)
                    .stream().filter(t -> !t.isCategorized()).toList()
                : transactionRepository.findByUserIdAndIsCategorizedFalse(userId);

        User user = userRepository.findById(userId).orElseThrow();
        List<Category> categories = categoryRepository.findByUserIdOrderByName(userId);

        // Group by merchant name
        Map<String, List<Transaction>> grouped = uncategorized.stream()
                .collect(Collectors.groupingBy(t ->
                        t.getMerchantName() != null ? t.getMerchantName() : t.getDescription()));

        List<CompletableFuture<Map<String, Object>>> futures = grouped.entrySet().stream()
                .map(entry -> CompletableFuture.supplyAsync(() -> {
                    String merchant = entry.getKey();
                    List<Transaction> txns = entry.getValue();

                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("merchant_name", merchant);
                    result.put("transaction_ids", txns.stream().map(Transaction::getId).toList());
                    result.put("transaction_count", txns.size());
                    result.put("total_amount", txns.stream().map(Transaction::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add));

                    try {
                        String suggestion = aiService.suggestCategory(merchant,
                                txns.get(0).getDescription(), categories, user);
                        var node = objectMapper.readTree(suggestion);
                        result.put("suggested_category_id", node.has("category_id") && !node.get("category_id").isNull()
                                ? node.get("category_id").asLong() : null);
                        result.put("suggested_new_category", node.has("suggested_new_category")
                                ? node.get("suggested_new_category").asText(null) : null);
                        result.put("confidence", node.has("confidence") ? node.get("confidence").asDouble() : 0.0);
                    } catch (Exception e) {
                        log.warn("AI suggestion failed for {}: {}", merchant, e.getMessage());
                        result.put("suggested_category_id", null);
                        result.put("confidence", 0.0);
                    }
                    return result;
                }, qaExecutor))
                .toList();

        return futures.stream()
                .map(f -> { try { return f.get(); } catch (Exception e) { return Map.<String,Object>of(); } })
                .filter(m -> !m.isEmpty())
                .toList();
    }

    @Transactional
    public Map<String, Object> answer(Long userId, QaAnswerRequest req) {
        if (req.getCategoryId() != null && req.getTransactionIds() != null) {
            int updated = transactionRepository.bulkCategorize(
                    req.getCategoryId(), req.getTransactionIds(), userId);

            if (req.isApplyRule() && req.getMerchantName() != null) {
                MerchantRule rule = MerchantRule.builder()
                        .userId(userId).pattern(req.getMerchantName())
                        .patternType("contains").categoryId(req.getCategoryId()).priority(0).build();
                merchantRuleRepository.save(rule);
            }
            return Map.of("updated", updated);
        }
        return Map.of("updated", 0);
    }

    @Transactional
    public Map<String, Object> skip(Long userId, QaAnswerRequest req) {
        Category uncategorized = categoryRepository.findByUserIdAndName(userId, "Uncategorized").orElse(null);
        if (uncategorized != null && req.getTransactionIds() != null) {
            transactionRepository.bulkCategorize(uncategorized.getId(), req.getTransactionIds(), userId);
        }
        return Map.of("skipped", req.getTransactionIds() != null ? req.getTransactionIds().size() : 0);
    }

    @Transactional
    public Map<String, Object> answerBatch(Long userId, List<QaAnswerRequest> reqs) {
        int total = 0;
        for (QaAnswerRequest req : reqs) {
            var result = answer(userId, req);
            total += (int) result.getOrDefault("updated", 0);
        }
        return Map.of("total_updated", total);
    }
}
