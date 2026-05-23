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
| `GROQ_API_KEY` | Groq API key (get free at console.groq.com) |
| `OPENROUTER_API_KEY` | OpenRouter API key (get free at openrouter.ai) |
| `SECRET_KEY` | Random 32+ char string for JWT signing |
| `ALLOW_REGISTRATION` | `true` to allow new signups, `false` to lock |
| `NEXT_PUBLIC_API_URL` | Your domain + `/api/v1` |

---

## Features

- Upload UAE bank statement screenshots (PNG/JPG)
- PaddleOCR extracts transactions (no AI needed for clean images)
- AI verification agent checks the math (Groq → OpenRouter fallback)
- Auto-categorization with merchant rules
- Q&A flow for uncategorized merchants (one at a time)
- Dashboard: Month / Quarter / Year filter
- Analytics: bar charts, pie charts, frequent places
- Categories: add/edit/delete, auto-rules
- Multi-user: each account sees only their own data
- CSV export
- Read-only transactions (cannot edit amounts or dates)

---

## Development (local)

```bash
# Backend only (without Docker):
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env  # fill in keys
uvicorn app.main:app --reload --port 8000

# Frontend only:
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```
