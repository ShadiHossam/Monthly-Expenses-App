import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.database import Base, engine
import app.models  # ensure all models are registered

# Create tables
Base.metadata.create_all(bind=engine)
os.makedirs(settings.upload_dir, exist_ok=True)

# Migrate: add columns / tables that may be missing from older DB versions
def _run_migrations():
    from datetime import datetime, timedelta, timezone
    with engine.connect() as conn:
        # users columns
        existing_users = {row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()}
        for col, definition in [
            ("groq_api_key", "VARCHAR"),
            ("openrouter_api_key", "VARCHAR"),
            ("anthropic_api_key", "VARCHAR"),
            ("ai_provider", "VARCHAR DEFAULT 'auto'"),
        ]:
            if col not in existing_users:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {definition}"))

        # Backfill Free subscriptions for existing users who don't have one
        tables = {row[0] for row in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
        if "subscriptions" in tables:
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            end_str = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(text("""
                INSERT INTO subscriptions (user_id, plan, pages_used, pages_limit, status, overage_enabled,
                                           current_period_start, current_period_end, created_at, updated_at)
                SELECT u.id, 'free', 0, 15, 'active', 0, :now, :end, :now, :now
                FROM users u
                WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
            """), {"now": now_str, "end": end_str})

        conn.commit()

_run_migrations()

if settings.secret_key.startswith("change-me"):
    import warnings
    warnings.warn(
        "SECRET_KEY is set to the default insecure value. "
        "Set SECRET_KEY to a random 32+ byte string in production.",
        stacklevel=1,
    )

app = FastAPI(title="Expense Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from app.api.auth import router as auth_router
from app.api.statements import router as statements_router
from app.api.transactions import router as transactions_router
from app.api.categories import router as categories_router
from app.api.merchants import router as merchants_router
from app.api.qa import router as qa_router
from app.api.analytics import router as analytics_router
from app.api.ai_chat import router as ai_chat_router
from app.api.settings import router as settings_router
from app.api.reports import router as reports_router
from app.api.billing import router as billing_router, webhook_router
from app.api.budgets import router as budgets_router

PREFIX = "/api/v1"
app.include_router(auth_router, prefix=PREFIX)
app.include_router(statements_router, prefix=PREFIX)
app.include_router(transactions_router, prefix=PREFIX)
app.include_router(categories_router, prefix=PREFIX)
app.include_router(merchants_router, prefix=PREFIX)
app.include_router(qa_router, prefix=PREFIX)
app.include_router(analytics_router, prefix=PREFIX)
app.include_router(ai_chat_router, prefix=PREFIX)
app.include_router(settings_router, prefix=PREFIX)
app.include_router(reports_router, prefix=PREFIX)
app.include_router(billing_router, prefix=PREFIX)
app.include_router(webhook_router, prefix=PREFIX)
app.include_router(budgets_router, prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
