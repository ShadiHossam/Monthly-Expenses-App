package com.expensetracker.repository;

import com.expensetracker.model.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    Optional<Transaction> findByIdAndUserId(Long id, Long userId);

    List<Transaction> findByUserIdAndIsCategorizedFalse(Long userId);

    List<Transaction> findByStatementIdAndUserId(Long statementId, Long userId);

    @Modifying
    @Query("UPDATE Transaction t SET t.categoryId = :catId, t.isCategorized = true WHERE t.id IN :ids AND t.userId = :userId")
    int bulkCategorize(@Param("catId") Long catId, @Param("ids") List<Long> ids, @Param("userId") Long userId);

    @Query(value = """
        SELECT * FROM transactions t
        WHERE t.user_id = :userId
        AND (CAST(:from AS date) IS NULL OR t.txn_date >= CAST(:from AS date))
        AND (CAST(:to AS date) IS NULL OR t.txn_date <= CAST(:to AS date))
        AND (CAST(:categoryId AS bigint) IS NULL OR t.category_id = CAST(:categoryId AS bigint))
        AND (CAST(:txnType AS varchar) IS NULL OR t.txn_type = CAST(:txnType AS varchar))
        AND (:search = '' OR LOWER(t.description) LIKE '%' || LOWER(:search) || '%'
             OR LOWER(COALESCE(t.merchant_name,'')) LIKE '%' || LOWER(:search) || '%')
        ORDER BY t.txn_date DESC, t.id DESC
        """, nativeQuery = true)
    Page<Transaction> findFiltered(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("categoryId") Long categoryId,
            @Param("txnType") String txnType,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.userId = :userId AND t.categoryId = :categoryId AND t.txnType = 'debit' AND FUNCTION('date_trunc', 'month', t.txnDate) = FUNCTION('date_trunc', 'month', CURRENT_DATE)")
    BigDecimal sumDebitThisMonthByCategory(@Param("userId") Long userId, @Param("categoryId") Long categoryId);

    @Query(value = """
        SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
        WHERE t.user_id = :userId AND t.category_id = :categoryId
        AND t.txn_type = 'debit'
        AND date_trunc('month', t.txn_date) = date_trunc('month', CURRENT_DATE)
        """, nativeQuery = true)
    BigDecimal sumDebitThisMonthByCategoryNative(@Param("userId") Long userId, @Param("categoryId") Long categoryId);

    @Query(value = """
        SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
        WHERE t.user_id = :userId AND t.category_id = :categoryId
        AND t.txn_type = 'debit'
        AND EXTRACT(YEAR FROM t.txn_date) = :year
        AND EXTRACT(MONTH FROM t.txn_date) = :month
        """, nativeQuery = true)
    BigDecimal sumDebitByMonthByCategoryNative(@Param("userId") Long userId, @Param("categoryId") Long categoryId, @Param("year") int year, @Param("month") int month);

    @Query(value = """
        SELECT
            to_char(date_trunc('month', t.txn_date), 'YYYY-MM') AS month,
            COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        WHERE t.user_id = :userId
          AND t.category_id = :categoryId
          AND t.txn_type = 'debit'
          AND t.txn_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
          AND t.txn_date < date_trunc('month', CURRENT_DATE)
        GROUP BY date_trunc('month', t.txn_date)
        ORDER BY 1
        """, nativeQuery = true)
    List<Object[]> monthlyDebitsByCategory(@Param("userId") Long userId, @Param("categoryId") Long categoryId);

    @Query(value = """
        SELECT
            to_char(date_trunc('month', t.txn_date), 'YYYY-MM') AS month,
            COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        WHERE t.user_id = :userId
          AND t.category_id = :categoryId
          AND t.txn_type = 'debit'
          AND t.txn_date >= :from
          AND t.txn_date < :to
        GROUP BY date_trunc('month', t.txn_date)
        ORDER BY 1
        """, nativeQuery = true)
    List<Object[]> monthlyDebitsByCategoryInRange(@Param("userId") Long userId, @Param("categoryId") Long categoryId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT t FROM Transaction t WHERE t.userId = :userId AND t.txnDate BETWEEN :from AND :to ORDER BY t.txnDate DESC")
    List<Transaction> findByUserIdAndDateRange(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.userId = :userId AND t.txnDate BETWEEN :from AND :to")
    long countByUserIdAndDateRange(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT t FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'debit' AND t.txnDate BETWEEN :from AND :to ORDER BY t.amount DESC")
    org.springframework.data.domain.Page<Transaction> findBiggestDebit(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            Pageable pageable);

    @Query(value = """
        SELECT
            t.category_id,
            COALESCE(SUM(t.amount), 0)  AS total,
            COUNT(*)                     AS txn_count
        FROM transactions t
        WHERE t.user_id = :userId
          AND t.txn_type = 'debit'
          AND t.txn_date BETWEEN :from AND :to
        GROUP BY t.category_id
        ORDER BY total DESC
        """, nativeQuery = true)
    List<Object[]> aggregateCategoryBreakdown(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(value = """
        SELECT
            CAST(EXTRACT(YEAR  FROM txn_date) AS INTEGER) AS yr,
            CAST(EXTRACT(MONTH FROM txn_date) AS INTEGER) AS mo,
            COALESCE(SUM(CASE WHEN txn_type = 'debit'  THEN amount ELSE 0 END), 0) AS debits,
            COALESCE(SUM(CASE WHEN txn_type = 'credit' THEN amount ELSE 0 END), 0) AS credits
        FROM transactions
        WHERE user_id = :userId
          AND txn_date BETWEEN :from AND :to
        GROUP BY 1, 2
        ORDER BY 1, 2
        """, nativeQuery = true)
    List<Object[]> aggregateMonthlyTotals(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'debit' AND t.txnDate BETWEEN :from AND :to")
    BigDecimal sumDebits(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'credit' AND t.txnDate BETWEEN :from AND :to")
    BigDecimal sumCredits(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT MIN(t.txnDate) FROM Transaction t WHERE t.userId = :userId AND t.txnDate BETWEEN :from AND :to")
    LocalDate findMinTxnDate(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT MAX(t.txnDate) FROM Transaction t WHERE t.userId = :userId AND t.txnDate BETWEEN :from AND :to")
    LocalDate findMaxTxnDate(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    long countByStatementId(Long statementId);

    @Modifying
    void deleteByStatementId(Long statementId);

    boolean existsByUserIdAndTxnDateAndAmountAndDescriptionAndTxnType(
            Long userId, LocalDate txnDate, BigDecimal amount, String description, String txnType);

    @Query(value = """
        SELECT
            COALESCE(merchant_name, description) AS merchant_name,
            COUNT(*) AS visit_count,
            COALESCE(SUM(amount), 0) AS total_spend,
            COALESCE(AVG(amount), 0) AS avg_spend
        FROM transactions
        WHERE user_id = :userId
          AND txn_date BETWEEN :from AND :to
        GROUP BY COALESCE(merchant_name, description)
        ORDER BY visit_count DESC
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> aggregateMerchants(
            @Param("userId") Long userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("lim") int limit);

    @Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'credit' AND t.txnDate >= :from AND t.txnDate <= :to")
    Optional<BigDecimal> sumCreditsBetween(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'debit' AND t.txnDate >= :from AND t.txnDate <= :to")
    Optional<BigDecimal> sumDebitsBetween(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    void deleteByUserId(Long userId);
}
