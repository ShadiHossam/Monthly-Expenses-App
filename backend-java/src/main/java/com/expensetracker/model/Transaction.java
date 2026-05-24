package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "statement_id", nullable = false)
    private Long statementId;

    @Column(name = "txn_date", nullable = false)
    private LocalDate txnDate;

    @Column(name = "ref_number")
    private String refNumber;

    @Column(nullable = false)
    private String description;

    @Column(name = "merchant_name")
    private String merchantName;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "txn_type", nullable = false)
    private String txnType;

    @Column(name = "balance_after", precision = 12, scale = 2)
    private BigDecimal balanceAfter;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "is_categorized", nullable = false)
    @Builder.Default
    private boolean isCategorized = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
