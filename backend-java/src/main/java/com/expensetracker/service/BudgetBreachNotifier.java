package com.expensetracker.service;

import com.expensetracker.model.BudgetBreachNotification;
import com.expensetracker.repository.BudgetBreachNotificationRepository;
import com.expensetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@RequiredArgsConstructor
@Slf4j
class BudgetBreachNotifier {

    private final EmailService emailService;
    private final BudgetBreachNotificationRepository breachNotificationRepository;
    private final UserRepository userRepository;

    // Runs off the HTTP thread so status() returns immediately.
    // Save-first pattern: claiming the unique DB row is the atomic gate.
    // If two concurrent notify() calls race, only one INSERT succeeds — the other
    // hits DataIntegrityViolationException and exits without sending a second email.
    // A crash after save but before send is safe: the row is already persisted so
    // the "alreadySent" fast-path in BudgetService will suppress future dispatches.
    @Async
    @SuppressWarnings("null") // Lombok @Builder doesn't carry @NonNull through — false positives
    public void notify(Long userId, Long categoryId, int year, int month,
                       String catName, BigDecimal spent, BigDecimal limit) {
        try {
            breachNotificationRepository.save(BudgetBreachNotification.builder()
                .userId(userId).categoryId(categoryId).year(year).month(month).build());
        } catch (DataIntegrityViolationException e) {
            return; // another thread beat us — email already sent or in-flight
        }
        userRepository.findById(userId).ifPresent(u -> {
            if (u.getEmail() == null || u.getEmail().endsWith("@noemail.local")) return;
            emailService.sendBudgetAlert(u.getEmail(), catName, spent, limit);
        });
    }
}
