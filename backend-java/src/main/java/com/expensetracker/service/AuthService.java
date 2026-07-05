package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import com.expensetracker.dto.request.LoginRequest;
import com.expensetracker.dto.request.RegisterRequest;
import com.expensetracker.dto.response.TokenResponse;
import com.expensetracker.dto.response.UserOut;
import com.expensetracker.exception.BusinessException;
import com.expensetracker.exception.EntityNotFoundException;
import com.expensetracker.exception.RateLimitException;
import com.expensetracker.model.Category;
import com.expensetracker.model.LoginAttempt;
import com.expensetracker.model.PasswordResetToken;
import com.expensetracker.model.Plan;
import com.expensetracker.model.Subscription;
import com.expensetracker.model.User;
import com.expensetracker.repository.BudgetAlertRepository;
import com.expensetracker.repository.BudgetBreachNotificationRepository;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.RecurringRuleRepository;
import com.expensetracker.repository.SavingsGoalRepository;
import com.expensetracker.repository.LoginAttemptRepository;
import com.expensetracker.repository.MerchantAliasRepository;
import com.expensetracker.repository.MerchantRuleRepository;
import com.expensetracker.repository.PasswordResetTokenRepository;
import com.expensetracker.repository.SavedReportRepository;
import com.expensetracker.repository.StatementRepository;
import com.expensetracker.repository.SubscriptionRepository;
import com.expensetracker.repository.TransactionRepository;
import com.expensetracker.repository.UsageLogRepository;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final BudgetAlertRepository budgetAlertRepository;
    private final BudgetBreachNotificationRepository budgetBreachNotificationRepository;
    private final RecurringRuleRepository recurringRuleRepository;
    private final SavingsGoalRepository savingsGoalRepository;
    private final MerchantRuleRepository merchantRuleRepository;
    private final MerchantAliasRepository merchantAliasRepository;
    private final SavedReportRepository savedReportRepository;
    private final StatementRepository statementRepository;
    private final TransactionRepository transactionRepository;
    private final UsageLogRepository usageLogRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AppProperties appProperties;

    private static final List<Object[]> SYSTEM_CATEGORIES = List.of(
        new Object[]{"Groceries",    "#10b981", "shopping_cart"},
        new Object[]{"Dining",       "#f59e0b", "restaurant"},
        new Object[]{"Transport",    "#3b82f6", "directions_car"},
        new Object[]{"Utilities",    "#8b5cf6", "bolt"},
        new Object[]{"Healthcare",   "#ef4444", "favorite"},
        new Object[]{"Entertainment","#ec4899", "movie"},
        new Object[]{"Shopping",     "#f97316", "shopping_bag"},
        new Object[]{"Income",       "#22c55e", "south"},
        new Object[]{"Transfer",     "#6b7280", "sync_alt"},
        new Object[]{"Subscriptions","#14b8a6", "autorenew"},
        new Object[]{"Cashback",     "#f59e0b", "redeem"}
        // "Uncategorized" removed: null category_id is the canonical uncategorized state (V14).
    );

    @Transactional
    public TokenResponse register(RegisterRequest req) {
        if (!appProperties.isAllowRegistration()) {
            throw new BusinessException("Registration is disabled", HttpStatus.FORBIDDEN);
        }
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new BusinessException("Username already taken", HttpStatus.CONFLICT);
        }
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new BusinessException("Email already in use", HttpStatus.CONFLICT);
        }

        User user = User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .build();
        user = userRepository.save(user);

        seedSystemCategories(user.getId());

        Subscription sub = Subscription.builder()
                .userId(user.getId())
                .plan(Plan.FREE.key)
                .pagesLimit(Plan.FREE.pageLimit)
                .build();
        subscriptionRepository.save(sub);

        String token = jwtUtil.create(user.getId());
        return TokenResponse.builder().token(token).user(toUserOut(user)).build();
    }

    private static final int MAX_FAIL_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 15;

    @Transactional
    public TokenResponse login(LoginRequest req, String clientIp) {
        String ip = clientIp != null && !clientIp.isBlank() ? clientIp : "unknown";
        checkRateLimit(ip);

        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new BusinessException("Invalid credentials", HttpStatus.UNAUTHORIZED));

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(OffsetDateTime.now())) {
            throw new BusinessException(
                "Account locked due to too many failed attempts. Try again later.", HttpStatus.UNAUTHORIZED);
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            int fails = user.getLoginFailCount() + 1;
            user.setLoginFailCount(fails);
            if (fails >= MAX_FAIL_ATTEMPTS) {
                user.setLockedUntil(OffsetDateTime.now().plusMinutes(LOCKOUT_MINUTES));
                user.setLoginFailCount(0);
            }
            userRepository.save(user);
            throw new BusinessException("Invalid credentials", HttpStatus.UNAUTHORIZED);
        }

        user.setLoginFailCount(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        String token = jwtUtil.create(user.getId());
        return TokenResponse.builder().token(token).user(toUserOut(user)).build();
    }

    public UserOut getMe(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        return toUserOut(user);
    }

    private void seedSystemCategories(Long userId) {
        for (Object[] cat : SYSTEM_CATEGORIES) {
            Category category = Category.builder()
                    .userId(userId)
                    .name((String) cat[0])
                    .color((String) cat[1])
                    .icon((String) cat[2])
                    .isSystem(true)
                    .build();
            categoryRepository.save(category);
        }
    }

    // Not @Transactional — a rollback on RateLimitException would undo the save,
    // leaving the count never committed and the limiter permanently bypassed.
    void checkRateLimit(String ip) {
        Instant now = Instant.now();
        LoginAttempt attempt = loginAttemptRepository.findByIp(ip).orElse(null);
        if (attempt == null) {
            try {
                loginAttemptRepository.save(LoginAttempt.builder()
                    .ip(ip).attemptCount(1).windowStart(now).build());
            } catch (org.springframework.dao.DataIntegrityViolationException ignored) {
                // Two concurrent first-logins from the same IP both saw null and raced to
                // INSERT. The unique constraint (V16) rejected the second — that's fine; the
                // first row was committed and this request should proceed normally.
            }
            return;
        }
        // Reset window if older than 60s
        if (attempt.getWindowStart().plusSeconds(60).isBefore(now)) {
            attempt.setAttemptCount(1);
            attempt.setWindowStart(now);
            attempt.setLockedUntil(null);
            loginAttemptRepository.save(attempt);
            return;
        }
        if (attempt.getLockedUntil() != null && attempt.getLockedUntil().isAfter(now)) {
            throw new RateLimitException("Too many login attempts. Please try again later.");
        }
        attempt.setAttemptCount(attempt.getAttemptCount() + 1);
        if (attempt.getAttemptCount() > 10) {
            // Persist the lock before throwing — without this save the throw would
            // be caught by the caller's @Transactional and the count rolled back.
            attempt.setLockedUntil(now.plusSeconds(300));
            loginAttemptRepository.save(attempt);
            throw new RateLimitException("Too many login attempts. Please try again later.");
        }
        loginAttemptRepository.save(attempt);
    }

    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void cleanupOldLoginAttempts() {
        loginAttemptRepository.deleteOlderThan(Instant.now().minus(24, ChronoUnit.HOURS));
    }

    @Transactional
    public UserOut updateProfile(Long userId, String email, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));

        if (email != null && !email.isBlank() && !email.equals(user.getEmail())) {
            if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
                throw new BusinessException("Current password is required to change email", HttpStatus.BAD_REQUEST);
            }
            if (userRepository.existsByEmail(email)) {
                throw new BusinessException("Email already in use", HttpStatus.CONFLICT);
            }
            user.setEmail(email);
        }

        if (newPassword != null && !newPassword.isBlank()) {
            if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
                throw new BusinessException("Current password is incorrect", HttpStatus.BAD_REQUEST);
            }
            if (newPassword.length() < 8) {
                throw new BusinessException("Password must be at least 8 characters", HttpStatus.BAD_REQUEST);
            }
            user.setPasswordHash(passwordEncoder.encode(newPassword));
        }

        return toUserOut(userRepository.save(user));
    }

    @Transactional
    public void deleteAccount(Long userId) {
        passwordResetTokenRepository.deleteByUserId(userId);
        budgetBreachNotificationRepository.deleteByUserId(userId);
        recurringRuleRepository.deleteByUserId(userId);
        savingsGoalRepository.deleteByUserId(userId);
        usageLogRepository.deleteByUserId(userId);
        transactionRepository.deleteByUserId(userId);
        statementRepository.deleteByUserId(userId);
        budgetAlertRepository.deleteByUserId(userId);
        merchantRuleRepository.deleteByUserId(userId);
        merchantAliasRepository.deleteByUserId(userId);
        savedReportRepository.deleteByUserId(userId);
        categoryRepository.deleteByUserId(userId);
        subscriptionRepository.deleteByUserId(userId);
        userRepository.deleteById(userId);
    }

    @Transactional
    public void forgotPassword(String email) {
        if (email == null || email.isBlank()) return;
        userRepository.findByEmail(email).ifPresent(user -> {
            passwordResetTokenRepository.deleteByUserId(user.getId());
            byte[] tokenBytes = new byte[32];
            new java.security.SecureRandom().nextBytes(tokenBytes);
            String token = HexFormat.of().formatHex(tokenBytes);
            passwordResetTokenRepository.save(PasswordResetToken.builder()
                .userId(user.getId())
                .token(token)
                .expiresAt(Instant.now().plusSeconds(3600))
                .used(false)
                .build());
            emailService.sendPasswordReset(email, token);
        });
        // Always returns 200 — no user enumeration
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || newPassword == null || newPassword.length() < 8) {
            throw new BusinessException("Invalid request", HttpStatus.BAD_REQUEST);
        }
        PasswordResetToken prt = passwordResetTokenRepository
            .findByTokenAndUsedFalse(token)
            .orElseThrow(() -> new BusinessException("Invalid or expired token", HttpStatus.BAD_REQUEST));
        if (prt.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("Token expired", HttpStatus.BAD_REQUEST);
        }
        User user = userRepository.findById(prt.getUserId())
            .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        prt.setUsed(true);
        passwordResetTokenRepository.save(prt);
    }

    public static UserOut toUserOut(User user) {
        return UserOut.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .createdAt(user.getCreatedAt())
                .groqApiKeySet(StringUtils.hasText(user.getGroqApiKey()))
                .openrouterApiKeySet(StringUtils.hasText(user.getOpenrouterApiKey()))
                .anthropicApiKeySet(StringUtils.hasText(user.getAnthropicApiKey()))
                .aiProvider(user.getAiProvider())
                .concurrentProcessing(user.getConcurrentProcessing())
                .role(user.getRole())
                .build();
    }
}
