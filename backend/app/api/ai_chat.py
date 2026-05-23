import json
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.config import PLANS
from app.database import get_db
from app.models.subscription import Subscription
from app.services import analytics_service
from app.services.ai.client import ai_client
from app.services.ai.context import set_user_ai_context
from app.services.ai.prompts import FINANCIAL_CHAT_PROMPT

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    question: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None


def _build_financial_context(user_id: int, from_date: date, to_date: date, db: Session) -> str:
    summary = analytics_service.get_summary(user_id, from_date, to_date, db)
    category_breakdown = analytics_service.get_category_breakdown(user_id, from_date, to_date, db)

    # Last 6 months of monthly data
    today = date.today()
    monthly = analytics_service.get_monthly_data(user_id, today.year, db)
    recent_months = [m for m in monthly if m["total_debits"] > 0 or m["total_credits"] > 0][-6:]

    context_parts = [
        f"Period: {from_date} to {to_date}",
        f"Total spent (debits): AED {summary['total_debits']:,.2f}",
        f"Total income (credits): AED {summary['total_credits']:,.2f}",
        f"Net: AED {summary['net']:,.2f}",
        f"Transaction count: {summary['transaction_count']}",
    ]

    if summary.get("opening_balance") is not None:
        context_parts.append(f"Opening balance: AED {summary['opening_balance']:,.2f}")
    if summary.get("closing_balance") is not None:
        context_parts.append(f"Closing balance: AED {summary['closing_balance']:,.2f}")

    if summary.get("biggest_expense"):
        be = summary["biggest_expense"]
        context_parts.append(
            f"Biggest expense: {be['description']} — AED {be['amount']:,.2f} on {be['date']}"
        )

    if category_breakdown:
        context_parts.append("\nSpending by category:")
        for cat in category_breakdown[:8]:
            context_parts.append(
                f"  - {cat['category_name']}: AED {cat['total']:,.2f} ({cat['percentage']}%, {cat['transaction_count']} txns)"
            )

    if recent_months:
        context_parts.append("\nRecent monthly summary:")
        for m in recent_months:
            context_parts.append(
                f"  - {m['month_label']} {today.year}: spent AED {m['total_debits']:,.2f}, income AED {m['total_credits']:,.2f}"
            )

    return "\n".join(context_parts)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    plan_key = sub.plan if sub else "free"
    if not PLANS.get(plan_key, PLANS["free"]).get("ai_chat", False):
        raise HTTPException(status_code=403, detail="AI chat requires a paid plan. Upgrade to Solo or higher.")

    today = date.today()
    from_date = date.fromisoformat(body.from_date) if body.from_date else date(today.year, today.month, 1)
    to_date = date.fromisoformat(body.to_date) if body.to_date else today

    set_user_ai_context(current_user)
    financial_context = _build_financial_context(current_user.id, from_date, to_date, db)
    system_prompt = FINANCIAL_CHAT_PROMPT.format(financial_context=financial_context)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": body.question},
    ]

    answer = await ai_client.complete(messages, temperature=0.3)
    return {"data": {"answer": answer}}
