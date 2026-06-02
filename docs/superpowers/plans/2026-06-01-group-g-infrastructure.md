# Group G — Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DB backup service to docker-compose, rewrite the README for Java, and add security headers in nginx and Caddy.

**Architecture:** Config-file-only changes. No Java or TypeScript code to write.

**Tech Stack:** Docker Compose, nginx, Caddy 2.

---

## Task G1: Database Backup Service

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Add `db-backup` service to `docker-compose.yml`**

Add after the `postgres` service definition:

```yaml
  db-backup:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      PGPASSWORD: ${DB_PASSWORD}
    volumes:
      - ./backups:/backups
    entrypoint: >
      /bin/sh -c "
        while true; do
          FILENAME=/backups/backup-$$(date +%Y%m%d-%H%M).sql.gz;
          pg_dump -h postgres -U $${DB_USER:-expense_user} $${DB_NAME:-expense_tracker} | gzip > $$FILENAME;
          echo \"Backup written: $$FILENAME\";
          find /backups -name '*.sql.gz' -mtime +7 -delete;
          sleep 86400;
        done
      "
    depends_on:
      postgres:
        condition: service_healthy
```

Note: `$$` is required for literal `$` inside docker-compose YAML string to avoid variable substitution.

- [ ] **Step 2: Add `./backups` to `.gitignore`**

```bash
echo "backups/" >> .gitignore
```

- [ ] **Step 3: Commit**
```bash
git add docker-compose.yml .gitignore
git commit -m "feat: add db-backup service to docker-compose (daily pg_dump, 7-day retention)"
```

---

## Task G2: Security Headers in nginx + Caddy

**Files:**
- Modify: `frontend-react/nginx.conf`
- Modify: `Caddyfile`

- [ ] **Step 1: Add security headers to `nginx.conf`**

Inside the `server { ... }` block, add after the `gzip_vary on;` line:

```nginx
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none';" always;
```

- [ ] **Step 2: Add security headers to `Caddyfile`**

The current Caddyfile has no headers. Add a `header` directive inside the `:80 { }` block before the `handle` directives:

```caddyfile
:80 {
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none';"
    }

    handle /api/* {
        reverse_proxy backend:8080
    }

    handle /health {
        reverse_proxy backend:8080
    }

    handle {
        reverse_proxy frontend:80
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add frontend-react/nginx.conf Caddyfile
git commit -m "feat: add security headers (CSP, X-Frame-Options, nosniff) in nginx and Caddy"
```

---

## Task G3: README Rewrite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README to find the Python/FastAPI sections**

```bash
grep -n "python\|uvicorn\|pip\|fastapi\|Python\|FastAPI" README.md
```

- [ ] **Step 2: Replace Python setup instructions with Java instructions**

Remove any section that mentions:
- `pip install -r requirements.txt`
- `uvicorn main:app`
- `python -m venv`
- FastAPI startup commands

Replace with:
```markdown
## Prerequisites

- Java 21+
- Docker & Docker Compose
- Node.js 18+ (for frontend dev only)

## Quick Start (Docker)

```bash
cp .env.example .env
# Fill in .env with your API keys (see comments in the file)
docker compose up --build
# App runs at http://localhost:3000
```

## Development

**Backend (Java / Spring Boot):**
```bash
cd backend-java
./gradlew bootRun
# Runs on port 8080
```

**Frontend (React / Vite):**
```bash
cd frontend-react
npm install
npm run dev
# Runs on port 5173 — proxies /api/* to localhost:8080
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `DB_USER`, `DB_PASSWORD`, `DB_NAME` — PostgreSQL credentials
- `SECRET_KEY` — random 32+ char string for JWT signing
- `GROQ_API_KEY` — for AI categorization (free tier available at console.groq.com)
- `STRIPE_*` — for billing (optional; leave blank to disable payments)
- `RESEND_API_KEY` — for email (password reset, budget alerts)
- `APP_URL` — your production domain (used in email links and Stripe redirects)
```

- [ ] **Step 3: Commit**
```bash
git add README.md
git commit -m "docs: rewrite README for Java/Spring Boot backend (remove Python/FastAPI references)"
```

---

## Verification

```bash
# Test backup service
docker compose up db-backup --build -d
sleep 10
ls -la backups/
# Expected: backup-YYYYMMDD-HHMM.sql.gz file present

# Test security headers
docker compose up --build -d
curl -I http://localhost:3000
# Expected output includes:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: default-src 'self'...
```
