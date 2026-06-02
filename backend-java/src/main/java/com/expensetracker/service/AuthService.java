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
import com.expensetracker.model.Plan;
import com.expensetracker.model.Subscription;
import com.expensetracker.model.User;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.LoginAttemptRepository;
import com.expensetracker.repository.SubscriptionRepository;
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
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AppProperties appProperties;

    private static final List<Object[]> SYSTEM_CATEGORIES = List.of(
        new Object[]{"Groceries",    "#10b981", "shopping-cart"},
        new Object[]{"Dining",       "#f59e0b", "utensils"},
        new Object[]{"Transport",    "#3b82f6", "car"},
        new Object[]{"Utilities",    "#8b5cf6", "zap"},
        new Object[]{"Healthcare",   "#ef4444", "heart"},
        new Object[]{"Entertainment","#ec4899", "music"},
        new Object[]{"Shopping",     "#f97316", "bag"},
        new Object[]{"Income",       "#22c55e", "arrow-down"},
        new Object[]{"Transfer",     "#6b7280", "arrows"},
        new Object[]{"Subscriptions","#14b8a6", "refresh"},
        new Object[]{"Uncategorized","#9ca3af", "tag"}
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

    @Transactional
    void checkRateLimit(String ip) {
        Instant now = Instant.now();
        LoginAttempt attempt = loginAttemptRepository.findByIp(ip).orElse(null);
        if (attempt == null) {
            loginAttemptRepository.save(LoginAttempt.builder()
                .ip(ip).attemptCount(1).windowStart(now).build());
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
            throw new RateLimitException("Too many login attempts. Please try again later.");
        }
        loginAttemptRepository.save(attempt);
    }

    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void cleanupOldLoginAttempts() {
        loginAttemptRepository.deleteOlderThan(Instant.now().minus(24, ChronoUnit.HOURS));
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
                .build();
    }
}
