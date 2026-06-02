# Group A — Security & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix JWT dual-storage XSS hole, add password reset, require email on register, add profile update, account deletion, and replace in-memory rate limiting with DB-backed.

**Architecture:** All changes are self-contained. Backend gets new Flyway migrations (V7–V9), new endpoints on `AuthController`, and a new `EmailService`. Frontend drops `localStorage` token usage entirely and gains two new pages + new UI sections in `SettingsPage`.

**Tech Stack:** Java 21 / Spring Boot 3.2.5, Flyway, Spring Data JPA, React 18 + TypeScript, Resend HTTP API via WebClient.

---

## Task 1: JWT Dual-Storage Fix (frontend)

**Files:**
- Modify: `frontend-react/src/lib/api.ts`
- Modify: `frontend-react/src/layouts/AppLayout.tsx`
- Modify: `frontend-react/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Replace `getToken()` and strip Bearer header from `api.ts`**

Replace lines 27–40 in `api.ts` with:

```typescript
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const incomingHeaders = (options.headers as Record<string, string>) ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...incomingHeaders,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });

  if (res.status === 401) {
    if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      window.location.href = "/login";
    }
    const err = await res.json().catch(() => ({ detail: "Unauthorized" }));
    throw new Error(err.detail || "Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;

  const accept = incomingHeaders["Accept"] ?? "";
  if (accept === "text/csv" || res.headers.get("content-type")?.startsWith("text/csv")) {
    return res.blob() as Promise<unknown> as Promise<T>;
  }
  return res.json();
}
```

Also remove the `getToken()` function entirely (lines 27–30 in the original).

- [ ] **Step 2: Fix `uploadStatement` in `api.ts` — remove manual `Authorization` header**

Find the `uploadStatement` function. Remove:
```typescript
const token = getToken();
// ...
headers: token ? { Authorization: `Bearer ${token}` } : {},
```
Replace with just `credentials: "include"` and no custom headers:
```typescript
const res = await fetch(url, {
  method: "POST",
  credentials: "include",
  body: formData,
});
```

- [ ] **Step 3: Fix `fetchSSE` in `api.ts` — remove manual `Authorization` header**

Find the `fetchSSE` function at the bottom of `api.ts`. Remove:
```typescript
const token = getToken();
// ...
headers: token ? { Authorization: `Bearer ${token}` } : {},
```
Replace with:
```typescript
const res = await fetch(`${API_BASE}${path}`, {
  credentials: "include",
  signal,
});
```

- [ ] **Step 4: Fix `AppLayout.tsx` — stop reading token from localStorage for auth check**

In `AppLayout.tsx`, find the `useEffect` that reads `localStorage.getItem("token")` to decide whether to redirect. Replace that check with a call to `api.me()`:

```typescript
useEffect(() => {
  api.me()
    .then(user => {
      setUser(user);
      setReady(true);
    })
    .catch(() => {
      navigate("/login");
    });
}, []);
```

Remove any `localStorage.getItem("token")` / `localStorage.setItem("token")` lines in `AppLayout.tsx`.

- [ ] **Step 5: Fix `SettingsPage.tsx` — stop reading user from localStorage**

In `SettingsPage.tsx`, replace:
```typescript
const u = localStorage.getItem("user");
if (u) setUser(JSON.parse(u));
```
With:
```typescript
api.me().then(setUser).catch(() => {});
```

- [ ] **Step 6: Clean up `login` and `register` API methods — stop writing to localStorage**

In `api.ts`, the `login` and `register` functions return `{ token, user }`. After this change the frontend no longer stores the token — the backend cookie handles it. The return value is still useful for reading `user` info. No change needed to the API methods themselves, but anywhere in the frontend that does `localStorage.setItem("token", ...)` must be removed.

Search across all `.tsx` files:
```bash
grep -r "localStorage" frontend-react/src --include="*.tsx" -n
```
For each hit, remove `setItem("token"...)` and `getItem("token")` calls. `setItem("user"...)` and `getItem("user")` can stay temporarily (user display) but are better replaced by `api.me()` calls.

- [ ] **Step 7: Fix logout — clear cookie via backend, remove localStorage**

`api.logout()` already calls `POST /auth/logout` which clears the HttpOnly cookie. In the logout handler in `SettingsPage.tsx` (the `logout()` function), change to:
```typescript
async function logout() {
  await api.logout().catch(() => {});
  navigate("/login");
}
```
Remove `localStorage.removeItem("token")` and `localStorage.removeItem("user")`.

- [ ] **Step 8: Commit**
```bash
git add frontend-react/src/lib/api.ts frontend-react/src/layouts/AppLayout.tsx frontend-react/src/pages/SettingsPage.tsx
git commit -m "fix: remove JWT localStorage storage — use HttpOnly cookie only (closes XSS vector)"
```

---

## Task 2: DB-Backed Rate Limiting

**Files:**
- Create: `backend-java/src/main/resources/db/migration/V7__login_attempts.sql`
- Create: `backend-java/src/main/java/com/expensetracker/model/LoginAttempt.java`
- Create: `backend-java/src/main/java/com/expensetracker/repository/LoginAttemptRepository.java`
- Modify: `backend-java/src/main/java/com/expensetracker/service/AuthService.java`

- [ ] **Step 1: Write migration**

`V7__login_attempts.sql`:
```sql
CREATE TABLE login_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMP
);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip);
```

- [ ] **Step 2: Create `LoginAttempt` entity**

```java
package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "login_attempts")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class LoginAttempt {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 45)
    private String ip;
    @Column(nullable = false)
    private int attemptCount;
    @Column(nullable = false)
    private Instant windowStart;
    private Instant lockedUntil;
}
```

- [ ] **Step 3: Create `LoginAttemptRepository`**

```java
package com.expensetracker.repository;

import com.expensetracker.model.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.Optional;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {
    Optional<LoginAttempt> findByIp(String ip);

    @Modifying
    @Query("DELETE FROM LoginAttempt la WHERE la.windowStart < :cutoff")
    void deleteOlderThan(Instant cutoff);
}
```

- [ ] **Step 4: Update `AuthService` — replace in-memory maps with DB calls**

Remove the two `ConcurrentHashMap` fields and the `checkRateLimit` method. Add `LoginAttemptRepository` injection. Replace `checkRateLimit(ip)` call with:

```java
@Transactional
void checkRateLimitDb(String ip) {
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
        throw new RateLimitException("Too many login attempts. Try again later.");
    }
    attempt.setAttemptCount(attempt.getAttemptCount() + 1);
    if (attempt.getAttemptCount() > 10) {
        throw new RateLimitException("Too many login attempts. Try again later.");
    }
    loginAttemptRepository.save(attempt);
}
```

In `login()`, replace `checkRateLimit(ip)` with `checkRateLimitDb(ip)`.

Add a cleanup scheduled task (add `@EnableScheduling` to `ExpenseTrackerApplication` if not present):
```java
@Scheduled(fixedDelay = 3_600_000) // every hour
@Transactional
public void cleanupOldAttempts() {
    loginAttemptRepository.deleteOlderThan(Instant.now().minus(24, ChronoUnit.HOURS));
}
```

- [ ] **Step 5: Commit**
```bash
git add backend-java/src/main/resources/db/migration/V7__login_attempts.sql \
        backend-java/src/main/java/com/expensetracker/model/LoginAttempt.java \
        backend-java/src/main/java/com/expensetracker/repository/LoginAttemptRepository.java \
        backend-java/src/main/java/com/expensetracker/service/AuthService.java
git commit -m "feat: replace in-memory login rate limiting with DB-backed LoginAttempt table"
```

---

## Task 3: Email Required on Register

**Files:**
- Create: `backend-java/src/main/resources/db/migration/V8__require_email.sql`
- Modify: `backend-java/src/main/java/com/expensetracker/dto/request/RegisterRequest.java`
- Modify: `backend-java/src/main/java/com/expensetracker/service/AuthService.java`
- Modify: `frontend-react/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Write migration**

`V8__require_email.sql`:
```sql
-- Fill placeholder for existing users with no email
UPDATE users SET email = username || '@noemail.local'
WHERE email IS NULL OR email = '';

-- Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

- [ ] **Step 2: Update `RegisterRequest`**

```java
@NotBlank(message = "Email is required")
@Email(message = "Invalid email format")
private String email;
```

- [ ] **Step 3: Update `AuthService.register()`** — the existing `StringUtils.hasText(req.getEmail())` guard can be removed since email is now always present:
```java
if (userRepository.existsByEmail(req.getEmail())) {
    throw new BusinessException("Email already in use", HttpStatus.CONFLICT);
}
```

- [ ] **Step 4: Frontend — mark email required in `RegisterPage.tsx`**

Find the email `<input>` element and add `required` attribute. Add `*` to the label. Change placeholder to "you@example.com *".

- [ ] **Step 5: Commit**
```bash
git add backend-java/src/main/resources/db/migration/V8__require_email.sql \
        backend-java/src/main/java/com/expensetracker/dto/request/RegisterRequest.java \
        backend-java/src/main/java/com/expensetracker/service/AuthService.java \
        frontend-react/src/pages/RegisterPage.tsx
git commit -m "feat: require email on registration + placeholder migration for existing accounts"
```

---

## Task 4: Password Reset Flow

**Files:**
- Create: `backend-java/src/main/resources/db/migration/V9__password_reset_tokens.sql`
- Create: `backend-java/src/main/java/com/expensetracker/model/PasswordResetToken.java`
- Create: `backend-java/src/main/java/com/expensetracker/repository/PasswordResetTokenRepository.java`
- Create: `backend-java/src/main/java/com/expensetracker/service/EmailService.java`
- Modify: `backend-java/src/main/java/com/expensetracker/config/AppProperties.java`
- Modify: `backend-java/src/main/java/com/expensetracker/config/WebClientConfig.java`
- Modify: `backend-java/src/main/java/com/expensetracker/controller/AuthController.java`
- Modify: `backend-java/src/main/java/com/expensetracker/service/AuthService.java`
- Create: `frontend-react/src/pages/ForgotPasswordPage.tsx`
- Create: `frontend-react/src/pages/ResetPasswordPage.tsx`
- Modify: `frontend-react/src/router.tsx`
- Modify: `frontend-react/src/pages/LoginPage.tsx`
- Modify: `frontend-react/src/lib/api.ts`
- Modify: `backend-java/src/main/resources/application.yml`
- Modify: `.env.example`

- [ ] **Step 1: Migration**

`V9__password_reset_tokens.sql`:
```sql
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prt_token ON password_reset_tokens(token);
```

- [ ] **Step 2: `PasswordResetToken` entity**

```java
package com.expensetracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "password_reset_tokens")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PasswordResetToken {
    @Id
    private UUID id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, unique = true, length = 64)
    private String token;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(nullable = false)
    private boolean used;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }
}
```

- [ ] **Step 3: `PasswordResetTokenRepository`**

```java
package com.expensetracker.repository;

import com.expensetracker.model.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByTokenAndUsedFalse(String token);
    void deleteByUserId(Long userId);
}
```

- [ ] **Step 4: Add Resend config to `AppProperties`**

Add a new inner class inside `AppProperties`:
```java
private Resend resend = new Resend();

@Data
public static class Resend {
    private String apiKey = "";
    private String from = "noreply@expensetracker.app";
    private String appUrl = "http://localhost:3000";
}
```

- [ ] **Step 5: Add to `application.yml`**

```yaml
  resend:
    api-key: ${RESEND_API_KEY:}
    from: ${RESEND_FROM:noreply@expensetracker.app}
    app-url: ${APP_URL:http://localhost:3000}
```

- [ ] **Step 6: Add to `.env.example`**

```
# Email (Resend — https://resend.com)
RESEND_API_KEY=re_your_key_here
RESEND_FROM=noreply@yourdomain.com
APP_URL=https://yourdomain.com
```

- [ ] **Step 7: Add `resendClient` bean to `WebClientConfig`**

```java
@Bean
public WebClient resendClient() {
    return WebClient.builder()
        .baseUrl("https://api.resend.com")
        .defaultHeader("Authorization", "Bearer " + appProperties.getResend().getApiKey())
        .defaultHeader("Content-Type", "application/json")
        .build();
}
```

- [ ] **Step 8: Create `EmailService`**

```java
package com.expensetracker.service;

import com.expensetracker.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

    @Qualifier("resendClient")
    private final WebClient resendClient;
    private final AppProperties appProperties;

    @Async
    public void sendPasswordReset(String toEmail, String token) {
        String resetUrl = appProperties.getResend().getAppUrl() + "/reset-password?token=" + token;
        String html = "<p>Click the link below to reset your password (expires in 1 hour):</p>"
            + "<p><a href=\"" + resetUrl + "\">" + resetUrl + "</a></p>"
            + "<p>If you did not request this, ignore this email.</p>";
        sendEmail(toEmail, "Reset your Expense Tracker password", html);
    }

    @Async
    public void sendBudgetAlert(String toEmail, String categoryName,
                                java.math.BigDecimal spent, java.math.BigDecimal limit) {
        String html = "<p>You have exceeded your <strong>" + categoryName + "</strong> budget.</p>"
            + "<p>Spent: AED " + spent + " / Limit: AED " + limit + "</p>";
        sendEmail(toEmail, "Budget Alert: " + categoryName + " limit exceeded", html);
    }

    private void sendEmail(String to, String subject, String html) {
        if (appProperties.getResend().getApiKey().isBlank()) {
            log.warn("RESEND_API_KEY not set — skipping email to {}", to);
            return;
        }
        try {
            resendClient.post()
                .uri("/emails")
                .bodyValue(Map.of(
                    "from", appProperties.getResend().getFrom(),
                    "to", to,
                    "subject", subject,
                    "html", html
                ))
                .retrieve()
                .bodyToMono(String.class)
                .block();
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}
```

- [ ] **Step 9: Add forgot/reset endpoints to `AuthController`**

Add to `AuthController`:
```java
@PostMapping("/forgot-password")
public ResponseEntity<Map<String, String>> forgotPassword(
        @RequestBody Map<String, String> body) {
    authService.forgotPassword(body.get("email"));
    return ResponseEntity.ok(Map.of("message", "If that email exists, a reset link has been sent."));
}

@PostMapping("/reset-password")
public ResponseEntity<Map<String, String>> resetPassword(
        @RequestBody Map<String, String> body) {
    authService.resetPassword(body.get("token"), body.get("newPassword"));
    return ResponseEntity.ok(Map.of("message", "Password updated."));
}
```

Add both paths to `SecurityConfig` as public (alongside `/auth/login`):
```java
.requestMatchers("/api/v1/auth/forgot-password", "/api/v1/auth/reset-password").permitAll()
```

- [ ] **Step 10: Add `forgotPassword` and `resetPassword` to `AuthService`**

```java
@Transactional
public void forgotPassword(String email) {
    if (email == null || email.isBlank()) return;
    userRepository.findByEmail(email).ifPresent(user -> {
        // Invalidate existing tokens
        passwordResetTokenRepository.deleteByUserId(user.getId());
        String token = HexFormat.of().formatHex(
            java.security.SecureRandom.getSeed(32));
        passwordResetTokenRepository.save(PasswordResetToken.builder()
            .userId(user.getId())
            .token(token)
            .expiresAt(Instant.now().plusSeconds(3600))
            .used(false)
            .build());
        emailService.sendPasswordReset(email, token);
    });
    // Always return 200 — no user enumeration
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
```

Also add `UserRepository.findByEmail`:
```java
Optional<User> findByEmail(String email);
```

- [ ] **Step 11: Add API methods to `api.ts`**

```typescript
forgotPassword: (email: string) =>
  request<{ message: string }>("/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email }),
  }),
resetPassword: (token: string, newPassword: string) =>
  request<{ message: string }>("/auth/reset-password", {
    method: "POST", body: JSON.stringify({ token, newPassword }),
  }),
```

- [ ] **Step 12: Create `ForgotPasswordPage.tsx`**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) return (
    <div className="text-center py-12">
      <h2 className="text-xl font-bold mb-2">Check your email</h2>
      <p className="text-sm text-gray-500 mb-4">If that email exists, a reset link has been sent.</p>
      <Link to="/login" className="text-blue-600 underline text-sm">Back to login</Link>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm mx-auto pt-16 px-6">
      <h1 className="text-2xl font-bold">Reset password</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="submit" disabled={loading}
        className="bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <Link to="/login" className="text-sm text-center text-gray-500 underline">Back to login</Link>
    </form>
  );
}
```

- [ ] **Step 13: Create `ResetPasswordPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Minimum 8 characters"); return; }
    setLoading(true); setError("");
    try {
      await api.resetPassword(token, password);
      navigate("/login?reset=1");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm mx-auto pt-16 px-6">
      <h1 className="text-2xl font-bold">Set new password</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
        placeholder="New password (min 8 chars)"
        className="border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
        placeholder="Confirm password"
        className="border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="submit" disabled={loading || !token}
        className="bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
```

- [ ] **Step 14: Add routes in `router.tsx`**

Import and add under `AuthLayout`:
```tsx
{ path: "/forgot-password", element: <ForgotPasswordPage /> },
{ path: "/reset-password",  element: <ResetPasswordPage /> },
```

- [ ] **Step 15: Add "Forgot password?" link in `LoginPage.tsx`**

Below the password input, add:
```tsx
<Link to="/forgot-password" className="text-sm text-right text-blue-600 underline self-end">
  Forgot password?
</Link>
```

- [ ] **Step 16: Commit**
```bash
git add -A
git commit -m "feat: password reset via email (Resend) with time-limited tokens"
```

---

## Task 5: Profile Update & Account Deletion

**Files:**
- Modify: `backend-java/src/main/java/com/expensetracker/controller/AuthController.java`
- Modify: `backend-java/src/main/java/com/expensetracker/service/AuthService.java`
- Modify: `frontend-react/src/pages/SettingsPage.tsx`
- Modify: `frontend-react/src/lib/api.ts`

- [ ] **Step 1: Add `PATCH /auth/profile` endpoint**

In `AuthController`:
```java
@PatchMapping("/profile")
public ResponseEntity<UserOut> updateProfile(
        @AuthenticationPrincipal Long userId,
        @RequestBody Map<String, String> body,
        HttpServletResponse httpResponse) {
    UserOut updated = authService.updateProfile(userId, body.get("email"),
        body.get("currentPassword"), body.get("newPassword"));
    return ResponseEntity.ok(updated);
}
```

In `AuthService`:
```java
@Transactional
public UserOut updateProfile(Long userId, String email, String currentPassword, String newPassword) {
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new EntityNotFoundException("User not found"));

    if (email != null && !email.isBlank() && !email.equals(user.getEmail())) {
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
```

- [ ] **Step 2: Add `DELETE /auth/profile` endpoint**

In `AuthController`:
```java
@DeleteMapping("/profile")
public ResponseEntity<Void> deleteAccount(
        @AuthenticationPrincipal Long userId,
        @RequestBody Map<String, String> body,
        HttpServletResponse httpResponse) {
    if (!"DELETE".equals(body.get("confirmation"))) {
        throw new BusinessException("Invalid confirmation", HttpStatus.BAD_REQUEST);
    }
    authService.deleteAccount(userId);
    // Clear auth cookie
    Cookie cookie = new Cookie(JwtAuthFilter.COOKIE_NAME, "");
    cookie.setHttpOnly(true); cookie.setSecure(true);
    cookie.setPath("/"); cookie.setMaxAge(0);
    httpResponse.addCookie(cookie);
    return ResponseEntity.noContent().build();
}
```

In `AuthService`:
```java
@Transactional
public void deleteAccount(Long userId) {
    // Delete in FK-safe order
    passwordResetTokenRepository.deleteByUserId(userId);
    transactionRepository.deleteByUserId(userId);
    statementRepository.deleteByUserId(userId);
    categoryRepository.deleteByUserId(userId);
    merchantRuleRepository.deleteByUserId(userId);
    merchantAliasRepository.deleteByUserId(userId);
    budgetAlertRepository.deleteByUserId(userId);
    savedReportRepository.deleteByUserId(userId);
    usageLogRepository.deleteByUserId(userId);
    subscriptionRepository.deleteByUserId(userId);
    userRepository.deleteById(userId);
}
```

Add `deleteByUserId(Long userId)` to each of the repositories listed above (Spring Data JPA derives this automatically).

- [ ] **Step 3: Add API methods to `api.ts`**

```typescript
updateProfile: (data: { email?: string; currentPassword?: string; newPassword?: string }) =>
  request<User>("/auth/profile", { method: "PATCH", body: JSON.stringify(data) }),
deleteAccount: (confirmation: string) =>
  request<void>("/auth/profile", { method: "DELETE", body: JSON.stringify({ confirmation }) }),
```

- [ ] **Step 4: Add Account section to `SettingsPage.tsx`**

Add a new section above the AI Configuration section:

```tsx
// State
const [email, setEmail] = useState("");
const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [profileSaving, setProfileSaving] = useState(false);
const [profileSaved, setProfileSaved] = useState(false);
const [profileError, setProfileError] = useState("");
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [deleteConfirm, setDeleteConfirm] = useState("");

// After api.me() resolves, seed email:
api.me().then(u => { setUser(u); setEmail(u.email ?? ""); });

// Profile save handler
async function handleProfileSave() {
  setProfileSaving(true); setProfileError(""); setProfileSaved(false);
  try {
    const payload: any = {};
    if (email !== user?.email) payload.email = email;
    if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
    await api.updateProfile(payload);
    setProfileSaved(true);
    setCurrentPassword(""); setNewPassword("");
    setTimeout(() => setProfileSaved(false), 3000);
  } catch (err: any) {
    setProfileError(err.message);
  } finally {
    setProfileSaving(false);
  }
}

// Delete handler
async function handleDeleteAccount() {
  if (deleteConfirm !== "DELETE") return;
  try {
    await api.deleteAccount("DELETE");
    navigate("/login");
  } catch (err: any) {
    setProfileError(err.message);
  }
}
```

JSX for the Account card (add before AI Configuration card):
```tsx
<div className="bg-ft-surface dark:bg-ve-surface rounded-2xl border border-ft-outline-variant dark:border-ve-outline p-6 mb-6">
  <h2 className="text-base font-semibold mb-4">Account</h2>
  {profileError && <p className="text-red-500 text-sm mb-3">{profileError}</p>}
  <div className="flex flex-col gap-3">
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        className="w-full border rounded-xl px-3 py-2 text-sm" />
    </div>
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">Current password</label>
      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
        placeholder="Required to change password" className="w-full border rounded-xl px-3 py-2 text-sm" />
    </div>
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">New password</label>
      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
        placeholder="Leave blank to keep current" className="w-full border rounded-xl px-3 py-2 text-sm" />
    </div>
    <button onClick={handleProfileSave} disabled={profileSaving}
      className="self-start bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50">
      {profileSaving ? "Saving…" : profileSaved ? "Saved!" : "Save account"}
    </button>
  </div>
  <hr className="my-5 border-ft-outline-variant dark:border-ve-outline" />
  <button onClick={() => setShowDeleteModal(true)}
    className="text-red-500 text-sm underline">Delete account</button>
  {showDeleteModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4">
        <h3 className="font-bold text-lg mb-2">Delete account?</h3>
        <p className="text-sm text-gray-500 mb-4">This permanently deletes all your data. Type <strong>DELETE</strong> to confirm.</p>
        <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
          placeholder="DELETE" className="w-full border rounded-xl px-3 py-2 text-sm mb-4" />
        <div className="flex gap-2">
          <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
            className="flex-1 border rounded-xl py-2 text-sm">Cancel</button>
          <button onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE"}
            className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm disabled:opacity-40">Delete</button>
        </div>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: profile update (email + password change) and account deletion with confirmation"
```

---

## Verification

```bash
# Start the app
docker compose up --build

# Test JWT cookie-only (no localStorage token)
# Open DevTools → Application → Local Storage → confirm no 'token' key
# Network tab → requests should have Cookie header, no Authorization header

# Test password reset
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
# Check Resend dashboard for email

# Test rate limiting (restarts survive)
# Log in 11x with wrong password from same IP → should get 429
docker compose restart backend
# Try 11th attempt → still 429 (DB-backed)

# Test account deletion
# Log in → Settings → Delete Account → type DELETE → confirm → redirects to /login
# Try to log in again → 401
```
