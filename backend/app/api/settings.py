from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/settings", tags=["settings"])


class AISettingsIn(BaseModel):
    groq_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ai_provider: str = "auto"
    concurrent_processing: Optional[int] = Field(None, ge=1, le=10)


class AISettingsOut(BaseModel):
    groq_api_key_set: bool
    openrouter_api_key_set: bool
    anthropic_api_key_set: bool
    ai_provider: str
    concurrent_processing: int


def _mask(key: Optional[str]) -> bool:
    return bool(key and key.strip())


def _get_concurrent(user) -> int:
    return getattr(user, "concurrent_processing", None) or 2


@router.get("/ai", response_model=AISettingsOut)
def get_ai_settings(current_user=Depends(get_current_user)):
    return AISettingsOut(
        groq_api_key_set=_mask(current_user.groq_api_key),
        openrouter_api_key_set=_mask(current_user.openrouter_api_key),
        anthropic_api_key_set=_mask(current_user.anthropic_api_key),
        ai_provider=current_user.ai_provider or "auto",
        concurrent_processing=_get_concurrent(current_user),
    )


@router.put("/ai", response_model=AISettingsOut)
def save_ai_settings(
    body: AISettingsIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.groq_api_key is not None:
        current_user.groq_api_key = body.groq_api_key.strip() or None
    if body.openrouter_api_key is not None:
        current_user.openrouter_api_key = body.openrouter_api_key.strip() or None
    if body.anthropic_api_key is not None:
        current_user.anthropic_api_key = body.anthropic_api_key.strip() or None
    current_user.ai_provider = body.ai_provider
    if body.concurrent_processing is not None:
        current_user.concurrent_processing = body.concurrent_processing
        from app.api.statements import set_process_concurrency
        set_process_concurrency(body.concurrent_processing)
    db.commit()
    db.refresh(current_user)
    return AISettingsOut(
        groq_api_key_set=_mask(current_user.groq_api_key),
        openrouter_api_key_set=_mask(current_user.openrouter_api_key),
        anthropic_api_key_set=_mask(current_user.anthropic_api_key),
        ai_provider=current_user.ai_provider or "auto",
        concurrent_processing=_get_concurrent(current_user),
    )
