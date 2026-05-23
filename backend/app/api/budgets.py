from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date
from typing import Optional
from app.auth import get_current_user
from app.database import get_db
from app.models.budget_alert import BudgetAlert
from app.models.statement import Transaction
from app.models.category import Category

router = APIRouter(prefix="/budgets", tags=["budgets"])


class BudgetCreate(BaseModel):
    category_id: int
    monthly_limit: float


class BudgetUpdate(BaseModel):
    monthly_limit: Optional[float] = None
    enabled: Optional[bool] = None


def _spent_this_month(db: Session, user_id: int, category_id: int) -> float:
    today = date.today()
    result = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user_id,
        Transaction.category_id == category_id,
        Transaction.txn_type == "debit",
        extract("year", Transaction.txn_date) == today.year,
        extract("month", Transaction.txn_date) == today.month,
    ).scalar()
    return float(result)


@router.get("")
def list_budgets(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    alerts = db.query(BudgetAlert).filter(BudgetAlert.user_id == current_user.id).all()
    result = []
    for alert in alerts:
        spent = _spent_this_month(db, current_user.id, alert.category_id)
        result.append({
            "id": alert.id,
            "category_id": alert.category_id,
            "category_name": alert.category.name if alert.category else None,
            "monthly_limit": float(alert.monthly_limit),
            "enabled": alert.enabled,
            "spent_this_month": spent,
            "created_at": alert.created_at,
            "updated_at": alert.updated_at,
        })
    return result


@router.post("", status_code=201)
def create_budget(body: BudgetCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    category = db.query(Category).filter(Category.id == body.category_id, Category.user_id == current_user.id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    existing = db.query(BudgetAlert).filter(
        BudgetAlert.user_id == current_user.id,
        BudgetAlert.category_id == body.category_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Budget alert for this category already exists")
    alert = BudgetAlert(
        user_id=current_user.id,
        category_id=body.category_id,
        monthly_limit=body.monthly_limit,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {
        "id": alert.id,
        "category_id": alert.category_id,
        "monthly_limit": float(alert.monthly_limit),
        "enabled": alert.enabled,
        "created_at": alert.created_at,
        "updated_at": alert.updated_at,
    }


@router.patch("/{alert_id}")
def update_budget(alert_id: int, body: BudgetUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    alert = db.query(BudgetAlert).filter(BudgetAlert.id == alert_id, BudgetAlert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Budget alert not found")
    if body.monthly_limit is not None:
        alert.monthly_limit = body.monthly_limit
    if body.enabled is not None:
        alert.enabled = body.enabled
    db.commit()
    db.refresh(alert)
    return {
        "id": alert.id,
        "category_id": alert.category_id,
        "monthly_limit": float(alert.monthly_limit),
        "enabled": alert.enabled,
        "created_at": alert.created_at,
        "updated_at": alert.updated_at,
    }


@router.delete("/{alert_id}", status_code=204)
def delete_budget(alert_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    alert = db.query(BudgetAlert).filter(BudgetAlert.id == alert_id, BudgetAlert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Budget alert not found")
    db.delete(alert)
    db.commit()


@router.get("/status")
def budget_status(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    alerts = db.query(BudgetAlert).filter(BudgetAlert.user_id == current_user.id).all()
    result = []
    for alert in alerts:
        limit = float(alert.monthly_limit)
        spent = _spent_this_month(db, current_user.id, alert.category_id)
        percentage = (spent / limit * 100) if limit > 0 else 0.0
        if spent >= limit:
            status = "exceeded"
        elif percentage >= 80:
            status = "warning"
        else:
            status = "ok"
        result.append({
            "id": alert.id,
            "category_id": alert.category_id,
            "category_name": alert.category.name if alert.category else None,
            "category_color": alert.category.color if alert.category else None,
            "monthly_limit": limit,
            "enabled": alert.enabled,
            "spent_this_month": spent,
            "percentage": round(percentage, 2),
            "status": status,
        })
    return result
