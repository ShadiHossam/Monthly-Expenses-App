from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models.statement import Transaction
from app.models.category import Category
from app.schemas.transaction import TransactionOut, CategoryPatch, BulkCategorize

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    category_id: Optional[int] = None,
    txn_type: Optional[str] = Query(None, alias="type"),
    merchant: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if from_date:
        q = q.filter(Transaction.txn_date >= from_date)
    if to_date:
        q = q.filter(Transaction.txn_date <= to_date)
    if category_id is not None:
        q = q.filter(Transaction.category_id == category_id)
    if txn_type:
        q = q.filter(Transaction.txn_type == txn_type)
    if merchant:
        q = q.filter(Transaction.merchant_name.ilike(f"%{merchant}%"))
    if search:
        q = q.filter(
            (Transaction.description.ilike(f"%{search}%")) |
            (Transaction.merchant_name.ilike(f"%{search}%"))
        )
    txns = q.order_by(Transaction.txn_date.desc()).offset(offset).limit(limit).all()
    return txns


@router.get("/uncategorized", response_model=list[TransactionOut])
def uncategorized(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    txns = (db.query(Transaction)
              .filter(Transaction.user_id == current_user.id)
              .filter(Transaction.is_categorized == False)
              .order_by(Transaction.txn_date.desc())
              .all())
    return txns


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(txn_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.patch("/{txn_id}/category", response_model=TransactionOut)
def set_category(txn_id: int, body: CategoryPatch, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    cat = db.query(Category).filter(Category.id == body.category_id, Category.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    txn.category_id = body.category_id
    txn.is_categorized = True
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/bulk-categorize")
def bulk_categorize(body: BulkCategorize, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == body.category_id, Category.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    updated = (db.query(Transaction)
                 .filter(Transaction.id.in_(body.transaction_ids))
                 .filter(Transaction.user_id == current_user.id)
                 .all())
    for txn in updated:
        txn.category_id = body.category_id
        txn.is_categorized = True
    db.commit()
    return {"data": {"updated": len(updated)}}
