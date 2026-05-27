package com.expensetracker.service;

import com.expensetracker.dto.response.AnalyticsSummary;
import com.expensetracker.model.Category;
import com.expensetracker.model.Statement;
import com.expensetracker.model.Transaction;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.StatementRepository;
import com.expensetracker.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Month;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TransactionRepository transactionRepository;
    private final StatementRepository statementRepository;
    private final CategoryRepository categoryRepository;

    public AnalyticsSummary summary(Long userId, LocalDate from, LocalDate to) {
        LocalDate f = from != null ? from : LocalDate.of(2000, 1, 1);
        LocalDate t = to != null ? to : LocalDate.now();

        BigDecimal debits = transactionRepository.sumDebits(userId, f, t);
        BigDecimal credits = transactionRepository.sumCredits(userId, f, t);
        debits = debits != null ? debits : BigDecimal.ZERO;
        credits = credits != null ? credits : BigDecimal.ZERO;

        List<Transaction> txns = transactionRepository.findByUserIdAndDateRange(userId, f, t);
        long count = txns.size();

        Transaction biggest = txns.stream()
                .filter(tx -> "debit".equals(tx.getTxnType()))
                .max(Comparator.comparing(Transaction::getAmount))
                .orElse(null);

        // Balance from latest statement
        BigDecimal closing = statementRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(Statement::getClosingBalance).filter(Objects::nonNull).findFirst().orElse(null);

        return AnalyticsSummary.builder()
                .totalDebits(debits)
                .totalCredits(credits)
                .net(credits.subtract(debits))
                .closingBalance(closing)
                .transactionCount(count)
                .biggestExpense(biggest != null ? AnalyticsSummary.BiggestExpense.builder()
                        .merchantName(biggest.getMerchantName() != null ? biggest.getMerchantName() : biggest.getDescription())
                        .amount(biggest.getAmount())
                        .date(biggest.getTxnDate())
                        .build() : null)
                .build();
    }

    public List<Map<String, Object>> monthly(Long userId, int year) {
        List<Transaction> txns = transactionRepository.findByUserIdAndDateRange(
                userId, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));

        Map<Integer, BigDecimal[]> byMonth = new TreeMap<>();
        for (int m = 1; m <= 12; m++) byMonth.put(m, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});

        for (Transaction t : txns) {
            int m = t.getTxnDate().getMonthValue();
            BigDecimal[] arr = byMonth.get(m);
            if ("debit".equals(t.getTxnType())) arr[0] = arr[0].add(t.getAmount());
            else arr[1] = arr[1].add(t.getAmount());
        }

        return byMonth.entrySet().stream().map(e -> {
            String label = Month.of(e.getKey()).getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", e.getKey());
            m.put("month_label", label);
            m.put("year", year);
            m.put("total_debits", e.getValue()[0]);
            m.put("total_credits", e.getValue()[1]);
            return m;
        }).toList();
    }

    public List<Map<String, Object>> categoryBreakdown(Long userId, LocalDate from, LocalDate to) {
        LocalDate f = from != null ? from : LocalDate.of(2000, 1, 1);
        LocalDate t = to != null ? to : LocalDate.now();

        List<Transaction> txns = transactionRepository.findByUserIdAndDateRange(userId, f, t)
                .stream().filter(tx -> "debit".equals(tx.getTxnType())).toList();

        BigDecimal total = txns.stream().map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<Long, BigDecimal> byCat = new LinkedHashMap<>();
        for (Transaction tx : txns) {
            byCat.merge(tx.getCategoryId(), tx.getAmount(), BigDecimal::add);
        }

        // Only fetch categories that are actually used — avoids loading all user categories
        List<Long> usedCatIds = byCat.keySet().stream().filter(Objects::nonNull).toList();
        Map<Long, Category> cats = usedCatIds.isEmpty()
                ? Map.of()
                : categoryRepository.findAllById(usedCatIds).stream()
                        .collect(Collectors.toMap(Category::getId, c -> c));

        // Pre-group transaction counts by category to avoid O(n²) stream filtering
        Map<Long, Long> countByCat = txns.stream()
                .collect(Collectors.groupingBy(
                        tx -> tx.getCategoryId() != null ? tx.getCategoryId() : -1L,
                        Collectors.counting()));

        return byCat.entrySet().stream()
                .sorted(Map.Entry.<Long, BigDecimal>comparingByValue().reversed())
                .map(e -> {
                    var cat = e.getKey() != null ? cats.get(e.getKey()) : null;
                    double pct = total.compareTo(BigDecimal.ZERO) > 0
                            ? e.getValue().divide(total, 4, RoundingMode.HALF_UP).doubleValue() * 100 : 0;
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("category_id", e.getKey());
                    m.put("category_name", cat != null ? cat.getName() : "Uncategorized");
                    m.put("color", cat != null ? cat.getColor() : "#9ca3af");
                    m.put("total", e.getValue());
                    m.put("percentage", Math.round(pct * 10.0) / 10.0);
                    m.put("transaction_count", countByCat.getOrDefault(
                            e.getKey() != null ? e.getKey() : -1L, 0L));
                    return m;
                }).toList();
    }

    public List<Map<String, Object>> frequentPlaces(Long userId, LocalDate from, LocalDate to) {
        LocalDate f = from != null ? from : LocalDate.now().minusMonths(3);
        LocalDate t = to != null ? to : LocalDate.now();

        List<Transaction> txns = transactionRepository.findByUserIdAndDateRange(userId, f, t)
                .stream().filter(tx -> "debit".equals(tx.getTxnType())).toList();

        Map<String, BigDecimal[]> byMerchant = new LinkedHashMap<>();
        for (Transaction tx : txns) {
            String name = tx.getMerchantName() != null ? tx.getMerchantName() : tx.getDescription();
            byMerchant.computeIfAbsent(name, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            byMerchant.get(name)[0] = byMerchant.get(name)[0].add(BigDecimal.ONE); // count
            byMerchant.get(name)[1] = byMerchant.get(name)[1].add(tx.getAmount());  // total
        }

        return byMerchant.entrySet().stream()
                .sorted((a, b) -> b.getValue()[0].compareTo(a.getValue()[0]))
                .limit(20)
                .map(e -> {
                    int visits = e.getValue()[0].intValue();
                    BigDecimal total = e.getValue()[1];
                    BigDecimal avg = visits > 0
                            ? total.divide(BigDecimal.valueOf(visits), 2, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;
                    String reason = visits >= 10 ? "Very frequent" : visits >= 5 ? "Frequent" : "Regular";
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("merchant_name", e.getKey());
                    m.put("visit_count", visits);
                    m.put("total_spent", total);
                    m.put("avg_spend", avg);
                    m.put("frequency_reason", reason);
                    return m;
                }).toList();
    }

    public List<Map<String, Object>> balanceTrend(Long userId) {
        return statementRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(s -> s.getPeriodEnd() != null && s.getClosingBalance() != null)
                .map(s -> {
                    String label = s.getPeriodEnd().getMonth()
                            .getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)
                            + " " + s.getPeriodEnd().getYear();
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("period_label", label);
                    m.put("closing_balance", s.getClosingBalance());
                    return m;
                }).toList();
    }

    public List<Map<String, Object>> recurring(Long userId) {
        List<Transaction> txns = transactionRepository.findByUserIdAndDateRange(
                userId, LocalDate.now().minusMonths(6), LocalDate.now());

        Map<Long, Category> categoryById = categoryRepository.findByUserIdOrderByName(userId)
                .stream().collect(Collectors.toMap(Category::getId, c -> c));

        Map<String, List<Transaction>> byMerchant = new LinkedHashMap<>();
        for (Transaction t : txns) {
            String name = t.getMerchantName() != null ? t.getMerchantName() : t.getDescription();
            byMerchant.computeIfAbsent(name, k -> new ArrayList<>()).add(t);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (var entry : byMerchant.entrySet()) {
            List<Transaction> group = entry.getValue();
            if (group.size() < 2) continue;

            List<Transaction> sorted = group.stream()
                    .sorted(Comparator.comparing(Transaction::getTxnDate)).toList();
            List<LocalDate> dates = sorted.stream().map(Transaction::getTxnDate).toList();

            long avgDays = 0;
            for (int i = 1; i < dates.size(); i++) {
                avgDays += dates.get(i - 1).until(dates.get(i), ChronoUnit.DAYS);
            }
            avgDays = avgDays / (dates.size() - 1);

            if (avgDays >= 25 && avgDays <= 35) {
                BigDecimal avgAmount = group.stream().map(Transaction::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(group.size()), 2, RoundingMode.HALF_UP);

                Transaction latest = sorted.get(sorted.size() - 1);
                Category cat = latest.getCategoryId() != null ? categoryById.get(latest.getCategoryId()) : null;

                List<Map<String, Object>> txnList = sorted.stream().map(t -> {
                    Map<String, Object> tx = new LinkedHashMap<>();
                    tx.put("id", t.getId());
                    tx.put("txn_date", t.getTxnDate());
                    tx.put("amount", t.getAmount());
                    return tx;
                }).toList();

                Map<String, Object> m = new LinkedHashMap<>();
                m.put("merchant_name", entry.getKey());
                m.put("amount", avgAmount);
                m.put("occurrences", group.size());
                m.put("months_seen", group.size());
                m.put("last_date", dates.get(dates.size() - 1));
                m.put("category_name", cat != null ? cat.getName() : null);
                m.put("category_color", cat != null ? cat.getColor() : null);
                m.put("transactions", txnList);
                result.add(m);
            }
        }
        return result;
    }

    public List<Map<String, Object>> monthComparison(Long userId, int months) {
        List<Map<String, Object>> result = new ArrayList<>();
        LocalDate now = LocalDate.now();
        for (int i = months - 1; i >= 0; i--) {
            LocalDate start = now.minusMonths(i).withDayOfMonth(1);
            LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
            BigDecimal debits = transactionRepository.sumDebits(userId, start, end);
            BigDecimal credits = transactionRepository.sumCredits(userId, start, end);
            String label = start.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)
                    + " " + start.getYear();
            Map<String, Object> m = new LinkedHashMap<>();
            BigDecimal d = debits != null ? debits : BigDecimal.ZERO;
            BigDecimal c = credits != null ? credits : BigDecimal.ZERO;
            m.put("month", start.getMonthValue());
            m.put("year", start.getYear());
            m.put("month_label", label);
            m.put("total_debits", d);
            m.put("total_credits", c);
            m.put("net", c.subtract(d));
            result.add(m);
        }
        return result;
    }
}
