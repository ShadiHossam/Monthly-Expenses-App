from contextvars import ContextVar

user_keys_var: ContextVar[dict | None] = ContextVar("user_ai_keys", default=None)
user_provider_var: ContextVar[str] = ContextVar("user_ai_provider", default="auto")


def set_user_ai_context(user) -> None:
    keys = {
        "groq": getattr(user, "groq_api_key", None) or None,
        "openrouter": getattr(user, "openrouter_api_key", None) or None,
        "anthropic": getattr(user, "anthropic_api_key", None) or None,
    }
    user_keys_var.set(keys if any(keys.values()) else None)
    user_provider_var.set(getattr(user, "ai_provider", None) or "auto")
