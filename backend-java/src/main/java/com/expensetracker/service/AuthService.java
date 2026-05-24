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
import com.expensetracker.model.Subscription;
import com.expensetracker.model.User;
import com.expensetracker.repository.CategoryRepository;
import com.expensetracker.repository.SubscriptionRepository;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final SubscriptionRepository subscriptionRepository;
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

    private final Map<String, AtomicInteger> loginAttempts = new ConcurrentHashMap<>();
    private final Map<String, Long> loginWindowStart = new ConcurrentHashMap<>();

    @Transactional
    public TokenResponse register(RegisterRequest req) {
        if (!appProperties.isAllowRegistration()) {
            throw new BusinessException("Registration is disabled", HttpStatus.FORBIDDEN);
        }
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new BusinessException("Username already taken", HttpStatus.CONFLICT);
        }
        if (StringUtils.hasText(req.getEmail()) && userRepository.existsByEmail(req.getEmail())) {
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
                .plan("free")
                .pagesLimit(15)
                .build();
        subscriptionRepository.save(sub);

        String token = jwtUtil.create(user.getId());
        return TokenResponse.builder().token(token).user(toUserOut(user)).build();
    }

    public TokenResponse login(LoginRequest req, String clientIp) {
        checkRateLimit(clientIp);

        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new BusinessException("Invalid credentials", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new BusinessException("Invalid credentials", HttpStatus.UNAUTHORIZED);
        }

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

    private void checkRateLimit(String ip) {
        long now = Instant.now().toEpochMilli();
        loginWindowStart.putIfAbsent(ip, now);

        if (now - loginWindowStart.get(ip) > 60_000) {
            loginWindowStart.put(ip, now);
            loginAttempts.put(ip, new AtomicInteger(0));
        }

        AtomicInteger attempts = loginAttempts.computeIfAbsent(ip, k -> new AtomicInteger(0));
        if (attempts.incrementAndGet() > 10) {
            throw new RateLimitException("Too many login attempts. Please try again later.");
        }
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
