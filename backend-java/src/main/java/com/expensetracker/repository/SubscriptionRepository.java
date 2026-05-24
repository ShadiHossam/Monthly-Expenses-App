package com.expensetracker.repository;

import com.expensetracker.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    Optional<Subscription> findByUserId(Long userId);
    Optional<Subscription> findByStripeCustomerId(String customerId);
    Optional<Subscription> findByStripeSubscriptionId(String subscriptionId);

    @Modifying
    @Query("UPDATE Subscription s SET s.pagesUsed = s.pagesUsed + :pages WHERE s.userId = :userId")
    int incrementPagesUsed(@Param("userId") Long userId, @Param("pages") int pages);
}
