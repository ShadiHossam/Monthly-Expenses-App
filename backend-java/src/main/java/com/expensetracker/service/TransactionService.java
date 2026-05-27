package com.expensetracker.service;

import com.expensetracker.dto.request.BulkCategorizeRequest;
import com.expensetracker.dto.request.TransactionRequest;
import com.expensetracker.dto.response.TransactionOut;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.model.Category;
import com.expensetracker.model.Statement;
import com.expensetracker.model.Transaction;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.StatementRepository;
import com.expensetracker.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;
    private final StatementRepository statementRepository;

    @Transactional
    public TransactionOut createManual(Long userId, TransactionRequest req) {
        Statement stmt = statementRepository.findByUserIdAndOcrEngine(userId, "manual")
                .orElseGet(() -> statementRepository.save(
                        Statement.builder()
                                .userId(userId)
                                .filename("Manual Entries")
                                .ocrEngine("manual")
                                .verifyStatus("verified")
                                .build()));

        Transaction t = Transaction.builder()
                .userId(userId)
                .statementId(stmt.getId())
                .txnDate(req.getTxnDate())
                .description(req.getDescription())
                .merchantName(req.getMerchantName())
                .amount(req.getAmount())
                .txnType(req.getTxnType())
                .refNumber(req.getRefNumber())
                .categoryId(req.getCategoryId())
                .isCategorized(req.getCategoryId() != null)
                .build();

        t = transactionRepository.save(t);
        return toOut(t, getCategoryMap(userId));
    }

    public Page<TransactionOut> list(Long userId, LocalDate from, LocalDate to,
                                     Long categoryId, String txnType, String search,
                                     int limit, int offset) {
        int page = offset / Math.max(limit, 1);
        Pageable pageable = PageRequest.of(page, Math.min(limit, 500));
        return transactionRepository
                .findFiltered(userId, from, to, categoryId, txnType, search, pageable)
                .map(t -> toOut(t, getCategoryMap(userId)));
    }

    public TransactionOut getById(Long id, Long userId) {
        Transaction t = transactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Transaction not found"));
        return toOut(t, getCategoryMap(userId));
    }

    @Transactional
    public TransactionOut updateCategory(Long id, Long userId, Long categoryId) {
        Transaction t = transactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Transaction not found"));
        t.setCategoryId(categoryId);
        t.setCategorized(true);
        t = transactionRepository.save(t);
        return toOut(t, getCategoryMap(userId));
    }

    @Transactional
    public int bulkCategorize(Long userId, BulkCategorizeRequest req) {
        return transactionRepository.bulkCategorize(req.getCategoryId(), req.getTransactionIds(), userId);
    }

    public List<TransactionOut> listUncategorized(Long userId) {
        Map<Long, Category> cats = getCategoryMap(userId);
        return transactionRepository.findByUserIdAndIsCategorizedFalse(userId)
                .stream().map(t -> toOut(t, cats)).toList();
    }

    public void streamCsv(Long userId, LocalDate from, LocalDate to, Long categoryId,
                           java.io.OutputStream out) throws java.io.IOException {
        List<Transaction> txns = transactionRepository.findByUserIdAndDateRange(
                userId, from != null ? from : LocalDate.of(2000, 1, 1),
                to != null ? to : LocalDate.now());
        if (categoryId != null) {
            txns = txns.stream().filter(t -> categoryId.equals(t.getCategoryId())).toList();
        }

        Map<Long, Category> cats = getCategoryMap(userId);
        PrintWriter pw = new PrintWriter(new java.io.OutputStreamWriter(out, StandardCharsets.UTF_8), false);
        pw.println("Date,Description,Merchant,Amount,Type,Category,Balance After");
        for (Transaction t : txns) {
            String catName = t.getCategoryId() != null && cats.containsKey(t.getCategoryId())
                    ? cats.get(t.getCategoryId()).getName() : "";
            pw.printf("%s,\"%s\",\"%s\",%s,%s,\"%s\",%s%n",
                t.getTxnDate(), esc(t.getDescription()), esc(t.getMerchantName()),
                t.getAmount(), t.getTxnType(), catName,
                t.getBalanceAfter() != null ? t.getBalanceAfter() : "");
        }
        pw.flush();
    }

    private Map<Long, Category> getCategoryMap(Long userId) {
        return categoryRepository.findByUserIdOrderByName(userId)
                .stream().collect(Collectors.toMap(Category::getId, Function.identity()));
    }

    private TransactionOut toOut(Transaction t, Map<Long, Category> cats) {
        Category cat = t.getCategoryId() != null ? cats.get(t.getCategoryId()) : null;
        return TransactionOut.builder()
                .id(t.getId()).userId(t.getUserId()).statementId(t.getStatementId())
                .txnDate(t.getTxnDate()).refNumber(t.getRefNumber()).description(t.getDescription())
                .merchantName(t.getMerchantName()).amount(t.getAmount()).txnType(t.getTxnType())
                .balanceAfter(t.getBalanceAfter()).categoryId(t.getCategoryId())
                .categoryName(cat != null ? cat.getName() : null)
                .categoryColor(cat != null ? cat.getColor() : null)
                .categoryIcon(cat != null ? cat.getIcon() : null)
                .isCategorized(t.isCategorized()).createdAt(t.getCreatedAt())
                .build();
    }

    private String esc(String s) {
        return s != null ? s.replace("\"", "\"\"") : "";
    }
}
