# Group B — Billing / Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Stripe redirect URL (APP_DOMAIN), document all required env vars, wire trial period days into Stripe checkout, and show an upgrade prompt when Free-tier users click Ask AI (this last item is covered in Group F — Task F3).

**Architecture:** Config-only changes + one small code fix in `BillingService`. No DB migrations needed.

**Tech Stack:** Java 21 / Spring Boot 3.2.5, Stripe Java SDK.

---

## Task B1: APP_URL / APP_DOMAIN Fix

**Files:**
- Modify: `backend-java/src/main/java/com/expensetracker/config/AppProperties.java`
- Modify: `backend-java/src/main/resources/application.yml`
- Modify: `backend-java/src/main/java/com/expensetracker/service/BillingService.java`
- Modify: `.env.example`

- [ ] **Step 1: Add `appUrl` field to `AppProperties`**

Inside the `AppProperties` class (after `allowRegistration`), add:
```java
private String appUrl = "http://localhost:3000";
```

In `application.yml`, under `app:`, add:
```yaml
  app-url: ${APP_URL:http://localhost:3000}
```

- [ ] **Step 2: Update `BillingService` to use `appProperties.getAppUrl()`**

Find all occurrences of `appProperties.getCorsOriginsList().get(0)` in `BillingService.java`. Replace with `appProperties.getAppUrl()`.

Run to confirm:
```bash
grep -n "getCorsOriginsList" backend-java/src/main/java/com/expensetracker/service/BillingService.java
```

- [ ] **Step 3: Add to `.env.example`**

Add a clearly commented section:
```bash
# ─── Billing (Stripe) ────────────────────────────────────────────────────────
# Get keys from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# Get price IDs from: https://dashboard.stripe.com/products
STRIPE_PRICE_SOLO=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_BUSINESS=price_xxx
STRIPE_PRICE_OVERAGE=price_xxx

# Your production domain — used for Stripe checkout redirect URLs
APP_URL=https://yourdomain.com
```

- [ ] **Step 4: Also add `APP_URL` to `docker-compose.yml` backend environment block**

```yaml
APP_URL: ${APP_URL:-http://localhost:3000}
```

- [ ] **Step 5: Commit**
```bash
git add backend-java/src/main/java/com/expensetracker/config/AppProperties.java \
        backend-java/src/main/resources/application.yml \
        backend-java/src/main/java/com/expensetracker/service/BillingService.java \
        .env.example docker-compose.yml
git commit -m "fix: use APP_URL for Stripe redirect URLs instead of CORS_ORIGINS[0]"
```

---

## Task B2: Trial Period in Stripe Checkout

**Files:**
- Modify: `backend-java/src/main/java/com/expensetracker/service/BillingService.java`

- [ ] **Step 1: Find `createCheckout` in `BillingService`**

```bash
grep -n "SessionCreateParams\|createCheckout\|trialDays\|trial" backend-java/src/main/java/com/expensetracker/service/BillingService.java
```

- [ ] **Step 2: Wire trial days into the Stripe session**

Find where `SessionCreateParams.builder()` is used. Locate the `plan` object (from `Plan.fromKey(planKey)`). Add trial period when `plan.getTrialDays() > 0`:

```java
SessionCreateParams.Builder builder = SessionCreateParams.builder()
    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
    .setSuccessUrl(appProperties.getAppUrl() + "/billing?success=1")
    .setCancelUrl(appProperties.getAppUrl() + "/billing?cancelled=true")
    .setCustomer(stripeCustomerId)
    .addLineItem(
        SessionCreateParams.LineItem.builder()
            .setPrice(priceId)
            .setQuantity(1L)
            .build()
    );

if (plan.getTrialDays() > 0) {
    builder.setSubscriptionData(
        SessionCreateParams.SubscriptionData.builder()
            .setTrialPeriodDays((long) plan.getTrialDays())
            .build()
    );
}

Session session = Session.create(builder.build());
```

- [ ] **Step 3: Commit**
```bash
git add backend-java/src/main/java/com/expensetracker/service/BillingService.java
git commit -m "feat: wire trialDays into Stripe checkout session for plans that have trials"
```

---

## Verification

```bash
# Verify APP_URL is used for Stripe redirects
# Set APP_URL=https://test.myapp.com in .env and restart
docker compose up --build

# Hit checkout (will fail without real Stripe keys, but check the error body)
curl -X POST http://localhost:3000/api/v1/billing/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<token>" \
  -d '{"plan":"solo"}'
# If Stripe keys are configured, success_url in the session should use APP_URL value

# Verify env vars are documented
cat .env.example | grep -A 10 "Billing"
```
