from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional
from app.auth import get_current_user
from app.database import get_db
from app.models.statement import Transaction
from app.models.merchant import MerchantAlias
from app.services.analytics_service import get_frequent_places


class AliasCreate(BaseModel):
    raw_name: str
    display_name: str


class AliasUpdate(BaseModel):
    display_name: str

router = APIRouter(tags=["merchants"])


@router.get("/merchants")
def list_merchants(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(
        Transaction.merchant_name,
        func.count(Transaction.id).label("visit_count"),
        func.sum(Transaction.amount).label("total_spend"),
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.txn_type == "debit",
    ).group_by(Transaction.merchant_name)

    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)

    rows = q.order_by(func.sum(Transaction.amount).desc()).all()
    return {"data": [{"merchant_name": r[0], "visit_count": r[1], "total_spend": float(r[2] or 0)} for r in rows]}


@router.get("/merchants/frequent")
def frequent_merchants(
    from_date: date = date(2020, 1, 1),
    to_date: date = date(2099, 12, 31),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_frequent_places(current_user.id, from_date, to_date, db)
    return {"data": data}


@router.get("/merchants/ranking")
def merchant_ranking(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(default=10, le=50),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Top N merchants by total spend, with rank number."""
    q = db.query(
        Transaction.merchant_name,
        func.count(Transaction.id).label("visit_count"),
        func.sum(Transaction.amount).label("total_spend"),
        func.avg(Transaction.amount).label("avg_spend"),
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.txn_type == "debit",
    ).group_by(Transaction.merchant_name)

    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)

    rows = q.order_by(func.sum(Transaction.amount).desc()).limit(limit).all()
    return {
        "data": [
            {
                "rank": i + 1,
                "merchant_name": r[0] or "Unknown",
                "visit_count": r[1],
                "total_spend": float(r[2] or 0),
                "avg_spend": round(float(r[3] or 0), 2),
            }
            for i, r in enumerate(rows)
        ]
    }


@router.get("/merchants/{merchant_name}/transactions")
def merchant_transactions(
    merchant_name: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    txns = (db.query(Transaction)
              .filter(Transaction.user_id == current_user.id)
              .filter(Transaction.merchant_name == merchant_name)
              .order_by(Transaction.txn_date.desc())
              .all())
    return {"data": txns}


@router.get("/merchant-aliases")
def list_aliases(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    aliases = db.query(MerchantAlias).filter(MerchantAlias.user_id == current_user.id).all()
    return {"data": aliases}


@router.post("/merchant-aliases")
def create_alias(body: AliasCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    alias = MerchantAlias(user_id=current_user.id, raw_name=body.raw_name, display_name=body.display_name)
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return {"data": alias}


@router.patch("/merchant-aliases/{alias_id}")
def update_alias(alias_id: int, body: AliasUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    alias = db.query(MerchantAlias).filter(MerchantAlias.id == alias_id, MerchantAlias.user_id == current_user.id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    alias.display_name = body.display_name
    db.commit()
    db.refresh(alias)
    return {"data": alias}


@router.delete("/merchant-aliases/{alias_id}", status_code=204)
def delete_alias(alias_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    alias = db.query(MerchantAlias).filter(MerchantAlias.id == alias_id, MerchantAlias.user_id == current_user.id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    db.delete(alias)
    db.commit()
