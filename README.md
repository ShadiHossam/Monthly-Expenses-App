# Expense Tracker

Personal bank statement expense tracker — PWA, multi-user, UAE bank format.

## Quick Start (Server Deploy)

### 1. Clone & configure
```bash
cp .env.example .env
# Edit .env: add GROQ_API_KEY, OPENROUTER_API_KEY, set your domain
# Edit Caddyfile: replace yourdomain.com with your actual domain
```

### 2. Create data directory
```bash
mkdir -p data/uploads
```

### 3. Build and start
```bash
docker compose up -d --build
```

The app will be available at your domain with automatic HTTPS via Caddy.

---

## Install on iPhone (PWA)
1. Open `https://yourdomain.com` in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. The app installs like a native app with its own icon

---

## Environment Variables

| Variable | Description |
|---|---|
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | PostgreSQL credentials |
| `SECRET_KEY` | Random 32+ char string for JWT signing |
| `GROQ_API_KEY` | Groq API key (get free at console.groq.com) |
| `OPENROUTER_API_KEY` | OpenRouter API key (get free at openrouter.ai) |
| `ANTHROPIC_API_KEY` | Anthropic API key (claude.ai) |
| `APP_URL` | Your production domain (used in Stripe redirects and emails) |
| `RESEND_API_KEY` | Resend API key for password reset and budget alert emails |
| `RESEND_FROM` | From address for emails (e.g. `noreply@yourdomain.com`) |
| `ALLOW_REGISTRATION` | `true` to allow new signups, `false` to lock |
| `STRIPE_SECRET_KEY` | Stripe secret key (optional — billing) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_SOLO/PRO/BUSINESS/OVERAGE` | Stripe price IDs for each plan |

---

## Features

- Upload UAE bank statement screenshots / PDFs (PNG/JPG/PDF)
- Tesseract OCR + AI vision (Anthropic/Groq/OpenRouter) extracts transactions
- Auto-categorization with merchant rules
- Q&A flow for uncategorized merchants (one at a time, with undo)
- Dashboard: Month / Quarter / Year / All-time filter
- Analytics: bar charts, pie charts, frequent places, balance trend
- Categories: CRUD with icon picker and AI suggestions
- Budgets: per-category monthly limits with breach email alerts
- Recurring: auto-detected subscriptions + manual rules
- Savings goals with progress tracking
- Multi-user: each account sees only their own data
- CSV export, Excel + PDF reports
- Password reset via email (Resend)
- PWA installable on iPhone via Safari

---

## Tech Stack

- **Backend:** Java 21 + Spring Boot 3.2 + PostgreSQL + Flyway
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **OCR:** Tesseract (local) + AI vision fallback (Anthropic/Groq/OpenRouter)
- **Deploy:** Docker Compose + Caddy (auto-HTTPS)

---

## Development (local)

**Prerequisites:** Java 21, Docker, Node.js 18+

```bash
# Full stack via Docker:
cp .env.example .env
# Fill in at minimum: DB_USER, DB_PASSWORD, SECRET_KEY, GROQ_API_KEY
docker compose up --build
# App runs at http://localhost:3000

# Backend only (hot-reload):
cd backend-java
./gradlew bootRun
# Runs on port 8080

# Frontend only (hot-reload):
cd frontend-react
npm install
npm run dev
# Runs on port 5173, proxies /api/* to localhost:8080
```
