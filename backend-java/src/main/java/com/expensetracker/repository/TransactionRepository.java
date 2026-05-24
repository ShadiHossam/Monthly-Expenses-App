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

    List<Transaction> findByStatementId(Long statementId);

    @Modifying
    @Query("UPDATE Transaction t SET t.categoryId = :catId, t.isCategorized = true WHERE t.id IN :ids AND t.userId = :userId")
    int bulkCategorize(@Param("catId") Long catId, @Param("ids") List<Long> ids, @Param("userId") Long userId);

    @Query(value = """
        SELECT * FROM transactions t
        WHERE t.user_id = :userId
        AND (:from IS NULL OR t.txn_date >= CAST(:from AS date))
        AND (:to IS NULL OR t.txn_date <= CAST(:to AS date))
        AND (:categoryId IS NULL OR t.category_id = :categoryId)
        AND (:txnType IS NULL OR t.txn_type = :txnType)
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

    @Query("SELECT t FROM Transaction t WHERE t.userId = :userId AND t.txnDate BETWEEN :from AND :to ORDER BY t.txnDate DESC")
    List<Transaction> findByUserIdAndDateRange(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'debit' AND t.txnDate BETWEEN :from AND :to")
    BigDecimal sumDebits(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.userId = :userId AND t.txnType = 'credit' AND t.txnDate BETWEEN :from AND :to")
    BigDecimal sumCredits(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    long countByStatementId(Long statementId);

    boolean existsByUserIdAndTxnDateAndAmountAndDescriptionAndTxnType(
            Long userId, LocalDate txnDate, BigDecimal amount, String description, String txnType);

    @Query(value = """
        SELECT
            COALESCE(merchant_name, description) AS merchant_name,
            COUNT(*) AS visit_count,
            COALESCE(SUM(amount), 0) AS total_spend
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
}
