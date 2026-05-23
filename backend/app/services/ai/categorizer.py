import json
from sqlalchemy.orm import Session
from app.models.category import Category, MerchantRule
from app.services.ai.prompts import CATEGORIZE_MERCHANT_PROMPT, AI_SUGGEST_CATEGORY_PROMPT
import re


def apply_merchant_rules(description: str, user_id: int, db: Session) -> tuple[int | None, str | None]:
    """Return (category_id, category_name) if a rule matches, else (None, None)."""
    rules = (
        db.query(MerchantRule)
        .filter(MerchantRule.user_id == user_id)
        .order_by(MerchantRule.priority.desc())
        .all()
    )
    text = description.lower()
    for rule in rules:
        pattern = rule.pattern.lower()
        if rule.pattern_type == "contains" and pattern in text:
            return rule.category_id, rule.category.name if rule.category else None
        elif rule.pattern_type == "startswith" and text.startswith(pattern):
            return rule.category_id, rule.category.name if rule.category else None
        elif rule.pattern_type == "regex":
            try:
                if re.search(pattern, text):
                    return rule.category_id, rule.category.name if rule.category else None
            except re.error:
                pass
    return None, None


async def suggest_category(merchant: str, description: str, user_id: int, db: Session, ai_client) -> dict:
    """Ask AI to suggest a category. Returns {category_id, confidence, reason}."""
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    cats_json = json.dumps([{"id": c.id, "name": c.name} for c in categories])

    prompt = CATEGORIZE_MERCHANT_PROMPT.format(
        merchant=merchant,
        description=description,
        categories_json=cats_json,
    )
    try:
        result = await ai_client.complete_json([{"role": "user", "content": prompt}])
        # Ensure suggested_new_category is always present in the response
        if "suggested_new_category" not in result:
            result["suggested_new_category"] = None
        return result
    except Exception:
        uncategorized = next((c for c in categories if c.name == "Uncategorized"), None)
        return {
            "category_id": uncategorized.id if uncategorized else None,
            "confidence": 0.0,
            "reason": "AI unavailable",
            "suggested_new_category": None,
        }


async def suggest_new_category_for_merchant(merchant: str, description: str, ai_client) -> dict:
    """Ask AI to suggest a brand-new category for a merchant. Returns {name, color, icon, reason}."""
    prompt = AI_SUGGEST_CATEGORY_PROMPT.format(
        merchant=merchant,
        description=description or "",
    )
    try:
        return await ai_client.complete_json([{"role": "user", "content": prompt}])
    except Exception:
        return {"name": "Other", "color": "#6b7280", "icon": "tag", "reason": "AI unavailable"}
