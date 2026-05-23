import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import hash_password, verify_password, create_token, get_current_user
from app.models.user import User
from app.models.category import Category
from app.models.subscription import Subscription
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut
from app.config import settings, PLANS

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple in-memory rate limiter: 10 attempts per IP per 60 seconds
_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_WINDOW = 60.0
_LOGIN_MAX = 10


def _check_login_rate(ip: str) -> None:
    now = time.time()
    window = _login_attempts[ip]
    cutoff = now - _LOGIN_WINDOW
    _login_attempts[ip] = [t for t in window if t > cutoff]
    if len(_login_attempts[ip]) >= _LOGIN_MAX:
        raise HTTPException(status_code=429, detail="Too many login attempts — try again in a minute")
    _login_attempts[ip].append(now)

SYSTEM_CATEGORIES = [
    ("Groceries",     "#16a34a", "shopping-cart"),
    ("Dining",        "#ea580c", "utensils"),
    ("Transport",     "#2563eb", "car"),
    ("Utilities",     "#7c3aed", "zap"),
    ("Healthcare",    "#dc2626", "heart-pulse"),
    ("Entertainment", "#ca8a04", "tv"),
    ("Shopping",      "#db2777", "bag"),
    ("Income",        "#10b981", "arrow-down-circle"),
    ("Transfer",      "#6b7280", "arrow-left-right"),
    ("Subscriptions", "#8b5cf6", "repeat"),
    ("Uncategorized", "#94a3b8", "help-circle"),
]


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if not settings.allow_registration:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()

    # Seed system categories for this user
    for name, color, icon in SYSTEM_CATEGORIES:
        db.add(Category(user_id=user.id, name=name, color=color, icon=icon, is_system=True))

    # Create Free subscription
    now = datetime.now(timezone.utc)
    db.add(Subscription(
        user_id=user.id,
        plan="free",
        pages_used=0,
        pages_limit=PLANS["free"]["pages"],
        status="active",
        overage_enabled=False,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    ))

    db.commit()
    db.refresh(user)
    return TokenResponse(token=create_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    _check_login_rate(ip)
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return TokenResponse(token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return UserOut.model_validate(current_user)
