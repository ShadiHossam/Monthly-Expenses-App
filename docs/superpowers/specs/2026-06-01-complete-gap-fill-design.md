# Complete Gap-Fill Design — Monthly Expenses PWA
**Date:** 2026-06-01  
**Scope:** All 19+ gaps identified in deep-analysis; 8 groups  
**Email service:** Resend  
**Email policy:** Required on register going forward  
**Transaction policy:** Deletion allowed; editing of amount/date/description not allowed  

---

## Group A — Security + Auth

### A1. JWT Dual-Storage Fix
- Remove all `localStorage.getItem("token")` / `localStorage.setItem("token")` calls from `frontend-react/src/lib/api.ts` and `frontend-react/src/layouts/AppLayout.tsx`.
- The backend already sets an HttpOnly `auth_token` cookie on login/register; the frontend only needs `credentials: 'include'` on every fetch. Ensure all `fetch()` calls in `api.ts` carry `credentials: 'include'`.
- Remove the `Authorization: Bearer …` header construction from `api.ts`.
- Delete the `token` key from `localStorage` on logout.
- **No backend change needed** — `JwtAuthFilter` already reads from the cookie.

### A2. Password Reset
**Backend:**
- Flyway migration `V7__password_reset_tokens.sql`: table `password_reset_tokens (id UUID PK, user_id FK, token VARCHAR(64) UNIQUE, expires_at TIMESTAMP, used BOOLEAN DEFAULT false, created_at TIMESTAMP)`.
- `POST /api/v1/auth/forgot-password` — public endpoint; accepts `{email}`; looks up user, generates a random 64-char hex token, stores it with `expires_at = now() + 1h`, sends email via `EmailService`. Always returns 200 (no user enumeration).
- `POST /api/v1/auth/reset-password` — public; accepts `{token, newPassword}`; validates token not expired/used, updates `user.password_hash`, marks token `used = true`.
- `EmailService` — new Spring `@Service` wrapping Resend HTTP API via `WebClient`. Config: `app.resend.api-key: ${RESEND_API_KEY:}`, `app.resend.from: ${RESEND_FROM:noreply@expensetracker.app}`. Method: `sendPasswordReset(String toEmail, String resetUrl)`.

**Frontend:**
- Add "Forgot password?" link on `LoginPage` → `/forgot-password`.
- New page `ForgotPasswordPage` (`/forgot-password`): email input + submit. Shows "Check your email" success state.
- New page `ResetPasswordPage` (`/reset-password?token=…`): new-password + confirm inputs. On success redirects to `/login`.
- Add both routes to `router.tsx` under `AuthLayout` (public).

### A3. Email Required on Register
- `RegisterRequest.email`: change from `@Email` (optional) to `@NotBlank @Email`.
- Flyway migration `V8__require_email.sql`: update existing users with null/blank email to `username || '@noemail.local'` placeholder so NOT NULL constraint can be applied.
- Add `UNIQUE` constraint on `users.email` in the same migration.
- Frontend `RegisterPage`: mark email field as required, add `*` label.

### A4. Profile Update / Password Change
- `PATCH /api/v1/auth/profile` — authenticated; accepts `{email?, currentPassword?, newPassword?}`; validates `currentPassword` matches before updating either field; returns updated `UserOut`.
- Frontend: new "Account" section at top of `SettingsPage` with email field + change-password form (current password, new password, confirm). Uses same save button pattern as AI settings section.

### A5. Account Deletion
- `DELETE /api/v1/auth/profile` — authenticated; accepts `{confirmation: "DELETE"}` in the request body; validates the string equals "DELETE" (400 otherwise). Hard delete: explicitly delete all child rows for the user (transactions, statements, categories, merchant_rules, merchant_aliases, budget_alerts, subscriptions, saved_reports, usage_logs, password_reset_tokens) then delete the user row. Clears auth cookie in the response.
- Frontend: "Delete Account" button at bottom of `SettingsPage` opens a modal — user types "DELETE" to enable the confirm button. On success navigates to `/login` with a `?deleted=1` param that shows a toast.

### A6. DB-Backed Rate Limiting
- Flyway migration `V9__login_attempts.sql`: table `login_attempts (id BIGSERIAL PK, ip VARCHAR(45), attempt_count INT DEFAULT 1, window_start TIMESTAMP, locked_until TIMESTAMP)`. Index on `ip`.
- Replace `ConcurrentHashMap` in `AuthService` with `LoginAttemptRepository` (Spring Data JPA). Same logic: 10 attempts/60s → 429; 5 failures → lock 15 min. `@Scheduled` cleanup job purges rows older than 24h.

---

## Group B — Billing / Stripe

### B1. APP_DOMAIN Env Var
- Add to `application.yml`: `app.domain: ${APP_DOMAIN:${CORS_ORIGINS:http://localhost:3000}}`.
- Add `getDomain()` to `AppProperties`. Update `BillingService` to use `appProperties.getDomain()` for Stripe success/cancel URLs.
- Add `APP_DOMAIN=https://yourdomain.com` to `.env.example` with a comment.

### B2. Stripe Env Wiring
- Add all missing Stripe env var placeholders to `.env.example` with comments explaining what each is and where to find it in the Stripe dashboard.
- No code change needed.

### B3. AI FAB Upgrade Prompt
- In `AskAIModal.tsx`: catch HTTP 403 from the chat API call. Instead of showing an error toast, render an upgrade card inline in the chat area: "AI chat requires Solo or higher. [View plans →]" linking to `/billing`.

### B4. Trial Period
- In `BillingService.createCheckout()`, when building `SessionCreateParams`, add `subscriptionData(SessionCreateParams.SubscriptionData.builder().trialPeriodDays((long) plan.getTrialDays()).build())` when `plan.getTrialDays() > 0`.

---

## Group C — Transaction Management

### C1. DELETE Endpoint
- Add `DELETE /api/v1/transactions/{id}` in `TransactionController` — validates `transaction.userId == authenticatedUserId` (403 otherwise), calls `transactionRepository.delete(transaction)`.
- Add `deleteById(Long id, Long userId)` to `TransactionService`.

### C2. Delete UI
- In `TransactionsPage.tsx`: add a red trash icon (`delete` Material Symbol) that appears on row hover (absolute positioned, right side).
- Clicking fires a small inline confirm: "Delete transaction?" with [Cancel] [Delete] buttons. On confirm, calls the DELETE endpoint and splices the row from local state.

### C3. Statement Error Display
- In `StatementsPage.tsx`: change the "failed" badge into a clickable button. On click, open a small modal showing `verifyErrors` parsed from JSON — display as a bulleted list of error strings, or the raw JSON in a `<pre>` if not parseable.

---

## Group D — Notifications

### D1. EmailService (Resend)
- New `EmailService` `@Service` in `com.expensetracker.service`.
- Uses existing `WebClient` pattern (add `resendClient` `@Bean` in `WebClientConfig` pointing to `https://api.resend.com`).
- Config: `app.resend.api-key`, `app.resend.from`.
- Two public methods: `sendPasswordReset(String to, String resetUrl)`, `sendBudgetAlert(String to, String categoryName, BigDecimal spent, BigDecimal limit)`.
- Both silently log and swallow errors (non-critical path — don't break the main flow if email fails).

### D2. Budget Breach Alerts
- Flyway migration `V10__budget_notifications.sql`: table `budget_breach_notifications (id BIGSERIAL PK, user_id FK, category_id FK, year INT, month INT, sent_at TIMESTAMP, UNIQUE(user_id, category_id, year, month))`.
- In `BudgetService.status()`: after computing `status == EXCEEDED`, check if a notification row exists for `(userId, categoryId, year, month)`. If not, insert the row and call `emailService.sendBudgetAlert(...)` async (`@Async`).
- Only sends if `user.email` is not a placeholder (`@noemail.local`).

### D3. Upload Completion In-App Toast
- In `UploadContext.tsx`: when an entry transitions to `status = "done"` and the user is not currently on `/upload`, enqueue a notification `{type: "upload_done", filename, txnCount}` into a `notifications` state array.
- In `AppLayout.tsx`: drain the `notifications` array on each route change; show a toast per notification ("✓ filename.pdf — 42 transactions imported"). Toast auto-dismisses after 5 seconds.

---

## Group E — UX Quick Wins (Frontend Only)

### E1. Dark/Light Mode Toggle
- In `AppLayout.tsx`: add a sun/moon icon button to the bottom of the sidebar.
- On click: toggle `document.documentElement.classList.toggle('dark')`, persist to `localStorage('theme')`.
- On app init (in `AppLayout` `useEffect`): read `localStorage('theme')` and apply the class.

### E2. Icon Picker for Categories
- In `CategoriesPage.tsx` category form: replace the free-text icon input with a scrollable grid of ~36 preset Material Symbol names (groceries, restaurant, car, home, etc.) shown as icon previews. Click to select. Keep a fallback text input for custom names below the grid.

### E3. Mobile Nav — Add Categories & Merchants
- In `AppLayout.tsx` `MOBILE_NAV`: add `{href: "/categories", label: "Categories", icon: "category"}` and `{href: "/merchants", label: "Merchants", icon: "storefront"}`. Trim all labels to ≤8 chars to fit the bottom bar.

### E4. Recurring — Fix Dead Link
- In `RecurringPage.tsx`: remove the "View Manual Setup" button or replace it with a scroll-to / expand-inline form. The full recurring CRUD (Group H) will replace this properly; for now, remove the dead button.

### E5. QA Undo Last Answer
- Backend: add `POST /api/v1/qa/unanswer/{questionId}` — sets the QA item back to `status = PENDING` and `null` answer.
- Frontend `UploadPage.tsx`: in the QA categorization step, add a "← Back" button. On click, calls the unanswer endpoint for the last answered question and decrements the progress pointer.

---

## Group F — OCR / AI Pipeline Fixes

### F1. TesseractParser Null Fix
- Read `TesseractParser.java` line ~151. If the null-returning path represents an unimplemented edge case, throw `new RuntimeException("TesseractParser: unhandled case — falling back to AI")` so the caller's try-catch triggers the AI fallback cleanly instead of NPE.

### F2. OCR Upload Rate Limiting
- In `StatementController.upload()`: before the quota check, enforce a per-user rate limit: max 5 uploads per 60 seconds. Use a `ConcurrentHashMap<Long, Deque<Instant>>` in `StatementController` (acceptable for single instance). Return `429 Too Many Requests` with `{"error": "Too many uploads, slow down"}` if exceeded.

---

## Group G — Infrastructure

### G1. DB Backup Service
- Add `db-backup` service to `docker-compose.yml`:
  ```yaml
  db-backup:
    image: postgres:16-alpine
    environment:
      PGPASSWORD: ${DB_PASSWORD}
    volumes:
      - ./backups:/backups
    entrypoint: >
      /bin/sh -c "while true; do
        pg_dump -h postgres -U ${DB_USER} ${DB_NAME}
        | gzip > /backups/backup-$$(date +%Y%m%d-%H%M).sql.gz;
        find /backups -name '*.sql.gz' -mtime +7 -delete;
        sleep 86400;
      done"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
  ```
- Add `./backups/` to `.gitignore`.

### G2. README Rewrite
- Remove all Python/FastAPI/uvicorn references.
- Add Java 21 + Gradle setup: `./gradlew bootRun` for backend dev, `npm run dev` for frontend dev, `docker compose up --build` for full stack.

### G3. Security Headers
- In `nginx.conf` (frontend container): add to the `server` block:
  ```
  add_header X-Frame-Options "DENY";
  add_header X-Content-Type-Options "nosniff";
  add_header X-XSS-Protection "1; mode=block";
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com;";
  add_header Referrer-Policy "strict-origin-when-cross-origin";
  ```
- In `Caddyfile`: add matching `header` directives.

---

## Group H — New Product Features

### H1. Recurring Rules (Manual CRUD)
- Flyway migration `V11__recurring_rules.sql`: table `recurring_rules (id BIGSERIAL PK, user_id FK, label VARCHAR(100), merchant_pattern VARCHAR(200), expected_amount DECIMAL(12,2), frequency_days INT, next_expected_date DATE, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP)`.
- `RecurringRuleController` at `/api/v1/recurring-rules`: full CRUD (GET list, POST create, PATCH update, DELETE).
- `RecurringPage.tsx`: add "Define Recurring" button → inline form (label, merchant pattern, amount, frequency in days, next date). Renders defined rules as a separate "Manual Rules" section above the auto-detected list.

### H2. Savings Goals
- Flyway migration `V12__savings_goals.sql`: table `savings_goals (id BIGSERIAL PK, user_id FK, name VARCHAR(100), target_amount DECIMAL(12,2), target_date DATE, color VARCHAR(7), created_at TIMESTAMP)`.
- `SavingsGoalController` at `/api/v1/savings-goals`: full CRUD.
- New `SavingsPage` at `/savings`: shows each goal as a card with a progress bar. Progress = `net income – expenses` over the period from goal creation to `target_date`, expressed as % of `target_amount`. Add `/savings` to `AppLayout` nav.

### H3. Multi-Currency — DEFERRED
- Requires exchange rate API, schema migration on `transactions.currency`, display changes throughout. Deferred to a dedicated future cycle.

---

## Execution Order

1. **A** (Security + Auth) — highest risk, touches auth flows
2. **E** (UX quick wins) — fast, frontend only, builds momentum  
3. **F** (OCR fixes) — small isolated backend changes  
4. **C** (Transaction management) — one backend endpoint + one UI change  
5. **B** (Billing) — env config + small code fixes  
6. **G** (Infrastructure) — config files  
7. **D** (Notifications) — new EmailService + two consumers  
8. **H** (New features) — largest scope, lowest urgency  

---

## Verification Plan

| Group | How to verify |
|-------|--------------|
| A1 JWT fix | DevTools → Application → localStorage: `token` key gone. Network tab: requests carry cookie, no Authorization header. |
| A2 Password reset | Register with email → `POST /forgot-password` → check Resend dashboard for email delivery → follow link → set new password → login with new password. |
| A3 Email required | `POST /register` without email → 400 validation error. |
| A4 Profile update | `PATCH /auth/profile` with wrong `currentPassword` → 403. With correct → 200, email updated. |
| A5 Account deletion | Type "DELETE" in modal → account gone → login attempt returns 401. |
| A6 Rate limit | Hammer login 11× in 60s → 429 response. Restart server → limit still enforced. |
| B1 APP_DOMAIN | Set `APP_DOMAIN=https://test.example.com` → checkout session's success_url uses that domain. |
| B3 AI FAB | Free-tier account → click Ask AI → upgrade card shown (not error toast). |
| C1+C2 Delete txn | Hover transaction row → trash icon appears → confirm → row gone. `GET /transactions` no longer includes it. |
| C3 Statement errors | Upload a bad file → statement shows "failed" badge → click it → error modal with readable message. |
| D1+D2 Budget email | Set a budget of AED 1 → upload any expense → check Resend dashboard for budget alert email. |
| D3 Upload toast | Start upload → navigate to `/dashboard` → upload completes → toast appears. |
| E1 Dark mode toggle | Click toggle → theme flips → refresh → same theme persists. |
| E2 Icon picker | Create category → icon grid shown → click icon → icon previews on category. |
| F1 Tesseract null | Upload with `OCR_PROVIDER=tesseract` → no NPE in logs, clean AI fallback. |
| F2 Rate limit | Upload 6 files rapidly → 6th returns 429. |
| G1 DB backup | `docker compose up` → `ls ./backups/` after 10s → backup file present (set sleep to 10 for testing). |
| G3 CSP headers | `curl -I http://localhost:3000` → `X-Frame-Options: DENY` present. |
| H1 Recurring rules | Create a rule → appears in RecurringPage "Manual Rules" section → edit → delete. |
| H2 Savings goals | Create goal → progress bar shows → add transactions that increase net savings → % updates. |
