package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "budget_breach_notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BudgetBreachNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(nullable = false)
    private int year;

    @Column(nullable = false)
    private int month;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @PrePersist
    void prePersist() {
        if (sentAt == null) sentAt = Instant.now();
    }
}
