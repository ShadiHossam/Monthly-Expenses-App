"""Billing API: usage info, Stripe checkout, customer portal, webhooks."""
import json
from datetime import datetime, timedelta, timezone

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import PLANS, OVERAGE_PRICE_ID, TRIAL_DAYS, settings
from app.database import get_db
from app.models.subscription import Subscription
from app.models.usage_log import UsageLog

router = APIRouter(prefix="/billing", tags=["billing"])


def _stripe():
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _get_or_create_sub(user_id: int, db: Session) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if sub is None:
        now = datetime.now(timezone.utc)
        sub = Subscription(
            user_id=user_id,
            plan="free",
            pages_used=0,
            pages_limit=PLANS["free"]["pages"],
            status="active",
            overage_enabled=False,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


# ---------------------------------------------------------------------------
# GET /billing/usage
# ---------------------------------------------------------------------------
@router.get("/usage")
def get_usage(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    sub = _get_or_create_sub(current_user.id, db)
    plan_info = PLANS.get(sub.plan, PLANS["free"])
    recent_logs = (
        db.query(UsageLog)
        .filter(UsageLog.user_id == current_user.id)
        .order_by(UsageLog.created_at.desc())
        .limit(30)
        .all()
    )
    return {
        "plan": sub.plan,
        "plan_label": plan_info["label"],
        "status": sub.status,
        "pages_used": sub.pages_used,
        "pages_limit": sub.pages_limit,
        "pages_remaining": max(0, sub.pages_limit - sub.pages_used),
        "overage_enabled": sub.overage_enabled,
        "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "usage_logs": [
            {
                "id": log.id,
                "statement_id": log.statement_id,
                "pages_consumed": log.pages_consumed,
                "action": log.action,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in recent_logs
        ],
    }


# ---------------------------------------------------------------------------
# GET /billing/plans  (public — no auth required)
# ---------------------------------------------------------------------------
@router.get("/plans")
def list_plans():
    return [
        {
            "key": key,
            "label": info["label"],
            "price_usd": info["price_usd"],
            "pages": info["pages"],
            "concurrent": info["concurrent"],
            "overage": info["overage"],
            "overage_price_usd": info.get("overage_price_usd"),
            "ai_chat": info["ai_chat"],
            "trial_days": info.get("trial_days", 0),
            "features": info["features"],
        }
        for key, info in PLANS.items()
    ]


# ---------------------------------------------------------------------------
# POST /billing/checkout
# ---------------------------------------------------------------------------
class CheckoutRequest(BaseModel):
    plan: str


@router.post("/checkout")
def create_checkout(
    body: CheckoutRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.plan not in PLANS or body.plan == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan_info = PLANS[body.plan]
    price_id = plan_info["price_id"]
    if not price_id:
        raise HTTPException(status_code=400, detail="Stripe price not configured for this plan")

    s = _stripe()
    sub = _get_or_create_sub(current_user.id, db)

    # Create or retrieve Stripe customer
    if sub.stripe_customer_id:
        customer_id = sub.stripe_customer_id
    else:
        customer = s.Customer.create(
            email=current_user.email or "",
            metadata={"user_id": str(current_user.id)},
        )
        customer_id = customer.id
        sub.stripe_customer_id = customer_id
        db.commit()

    trial_days = plan_info.get("trial_days", 0)
    # Only give trial if user has never had a paid plan before
    already_trialed = sub.plan != "free" or sub.stripe_subscription_id is not None
    use_trial = trial_days > 0 and not already_trialed

    session_kwargs: dict = dict(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{_frontend_url()}/billing?success=1",
        cancel_url=f"{_frontend_url()}/billing",
        metadata={"user_id": str(current_user.id), "plan": body.plan},
    )

    if use_trial:
        # 30-day trial with NO card required upfront
        session_kwargs["subscription_data"] = {"trial_period_days": trial_days}
        session_kwargs["payment_method_collection"] = "if_required"

    session = s.checkout.Session.create(**session_kwargs)
    return {"checkout_url": session.url, "trial_days": trial_days if use_trial else 0}


# ---------------------------------------------------------------------------
# POST /billing/portal
# ---------------------------------------------------------------------------
@router.post("/portal")
def create_portal(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    sub = _get_or_create_sub(current_user.id, db)
    if not sub.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription to manage")

    s = _stripe()
    session = s.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{_frontend_url()}/billing",
    )
    return {"portal_url": session.url}


# ---------------------------------------------------------------------------
# POST /webhooks/stripe  (no auth — verified by Stripe signature)
# ---------------------------------------------------------------------------
webhook_router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@webhook_router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    payload = await request.body()
    s = _stripe()

    try:
        event = s.Webhook.construct_event(
            payload, stripe_signature, settings.stripe_webhook_secret
        )
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    _handle_stripe_event(event, db)
    return {"received": True}


def _handle_stripe_event(event: dict, db: Session):
    etype = event["type"]
    data = event["data"]["object"]

    if etype == "checkout.session.completed":
        user_id = int(data["metadata"].get("user_id", 0))
        plan_key = data["metadata"].get("plan", "free")
        if not user_id:
            return
        sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
        if not sub:
            return
        plan_info = PLANS.get(plan_key, PLANS["free"])
        sub.plan = plan_key
        sub.stripe_subscription_id = data.get("subscription")
        sub.pages_limit = plan_info["pages"]
        sub.pages_used = 0
        sub.status = "active"
        sub.overage_enabled = plan_info["overage"]
        now = datetime.now(timezone.utc)
        sub.current_period_start = now
        sub.current_period_end = now + timedelta(days=30)
        db.commit()

    elif etype == "customer.subscription.updated":
        _sync_subscription(data, db)

    elif etype == "customer.subscription.deleted":
        _downgrade_to_free(data.get("customer"), db)

    elif etype == "invoice.payment_succeeded":
        # New billing period: reset pages_used
        customer_id = data.get("customer")
        sub = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
        if sub:
            sub.pages_used = 0
            # Update period dates from invoice
            period_start = data.get("period_start")
            period_end = data.get("period_end")
            if period_start:
                sub.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
            if period_end:
                sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
            db.commit()

    elif etype == "invoice.payment_failed":
        customer_id = data.get("customer")
        sub = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
        if sub:
            sub.status = "past_due"
            db.commit()


def _sync_subscription(stripe_sub: dict, db: Session):
    """Sync a Stripe subscription object into our DB."""
    customer_id = stripe_sub.get("customer")
    sub = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
    if not sub:
        return

    status = stripe_sub.get("status", "active")
    sub.stripe_subscription_id = stripe_sub.get("id")
    sub.status = status

    # Determine plan from price ID
    price_id = None
    items = stripe_sub.get("items", {}).get("data", [])
    if items:
        price_id = items[0].get("price", {}).get("id")

    if price_id:
        for key, info in PLANS.items():
            if info.get("price_id") == price_id:
                sub.plan = key
                sub.pages_limit = info["pages"]
                sub.overage_enabled = info["overage"]
                break

    period_start = stripe_sub.get("current_period_start")
    period_end = stripe_sub.get("current_period_end")
    if period_start:
        sub.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
    if period_end:
        sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

    db.commit()


def _downgrade_to_free(customer_id: str | None, db: Session):
    if not customer_id:
        return
    sub = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
    if not sub:
        return
    sub.plan = "free"
    sub.stripe_subscription_id = None
    sub.pages_limit = PLANS["free"]["pages"]
    sub.status = "canceled"
    sub.overage_enabled = False
    db.commit()


def _frontend_url() -> str:
    origins = settings.cors_origins
    if origins:
        return origins[0].rstrip("/")
    return "http://localhost:3000"
