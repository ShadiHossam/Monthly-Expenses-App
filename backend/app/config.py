from pydantic_settings import BaseSettings
from typing import List, Dict, Any


class Settings(BaseSettings):
    database_url: str = "sqlite:////app/data/expense_tracker.db"
    upload_dir: str = "/app/data/uploads"
    secret_key: str = "change-me-in-production-use-32-random-bytes"
    algorithm: str = "HS256"
    access_token_expire_days: int = 30
    allow_registration: bool = True
    ocr_confidence_threshold: float = 0.75
    ai_max_retries: int = 2
    cors_origins: List[str] = ["http://localhost:3000"]

    groq_api_key: str = ""
    openrouter_api_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    stripe_price_solo: str = ""
    stripe_price_pro: str = ""
    stripe_price_business: str = ""
    stripe_price_overage: str = ""  # metered price for Business plan overage

    ai_models: List[dict] = [
        {
            "provider": "groq",
            "model": "meta-llama/llama-4-scout-17b-16e-instruct",
            "api_base": "https://api.groq.com/openai/v1",
            "api_key_env": "groq_api_key",
            "rpm_limit": 15,
            "vision": True,
        },
        {
            "provider": "groq",
            "model": "llama-3.3-70b-versatile",
            "api_base": "https://api.groq.com/openai/v1",
            "api_key_env": "groq_api_key",
            "rpm_limit": 30,
            "vision": False,
        },
        {
            "provider": "openrouter",
            "model": "google/gemini-2.0-flash-exp:free",
            "api_base": "https://openrouter.ai/api/v1",
            "api_key_env": "openrouter_api_key",
            "rpm_limit": 20,
            "vision": True,
        },
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Free trial: 30-day trial on first paid plan, no card required
TRIAL_DAYS = 30

# Plan definitions: pages/month, max concurrent uploads, Stripe price ID, overage allowed
PLANS: Dict[str, Any] = {
    "free": {
        "label": "Free",
        "price_usd": 0,
        "pages": 15,
        "concurrent": 1,
        "price_id": None,
        "overage": False,
        "ai_chat": False,
        "trial_days": 0,
        "features": ["15 pages / month", "1 concurrent upload", "OCR + AI extraction", "Analytics & reports"],
    },
    "solo": {
        "label": "Solo",
        "price_usd": 4.99,
        "pages": 75,
        "concurrent": 2,
        "price_id": settings.stripe_price_solo,
        "overage": False,
        "ai_chat": True,
        "trial_days": TRIAL_DAYS,
        "features": ["75 pages / month", "2 concurrent uploads", "AI chat assistant", "Analytics & reports", "30-day free trial"],
    },
    "pro": {
        "label": "Pro",
        "price_usd": 14.99,
        "pages": 300,
        "concurrent": 5,
        "price_id": settings.stripe_price_pro,
        "overage": False,
        "ai_chat": True,
        "trial_days": TRIAL_DAYS,
        "features": ["300 pages / month", "5 concurrent uploads", "Priority processing", "AI chat assistant", "Analytics & reports", "30-day free trial"],
    },
    "business": {
        "label": "Business",
        "price_usd": 39.99,
        "pages": 1500,
        "concurrent": 10,
        "price_id": settings.stripe_price_business,
        "overage": True,
        "overage_price_usd": 0.10,
        "ai_chat": True,
        "trial_days": TRIAL_DAYS,
        "features": ["1,500 pages / month", "10 concurrent uploads", "$0.10 / page overage", "Priority processing", "AI chat assistant", "Analytics & reports", "30-day free trial"],
    },
}

OVERAGE_PRICE_ID = settings.stripe_price_overage
