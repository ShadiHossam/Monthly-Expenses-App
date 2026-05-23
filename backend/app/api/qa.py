import asyncio
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import defaultdict
from typing import Optional
from app.auth import get_current_user
from app.database import get_db
from app.models.statement import Transaction
from app.models.category import Category, MerchantRule
from app.services.ai.categorizer import suggest_category
from app.services.ai.client import ai_client
from app.schemas.analytics import QAAnswer, QASkip, QAPendingOut

router = APIRouter(prefix="/qa", tags=["qa"])

_suggest_sem = asyncio.Semaphore(5)


@router.get("/pending", response_model=list[QAPendingOut])
async def get_pending(
    statement_id: Optional[int] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_categorized == False,
    )
    if statement_id:
        q = q.filter(Transaction.statement_id == statement_id)
    txns = q.all()

    groups: dict[str, list[Transaction]] = defaultdict(list)
    for t in txns:
        key = t.merchant_name or t.description
        groups[key].append(t)

    cats_by_id: dict[int, Category] = {
        c.id: c for c in db.query(Category).filter(Category.user_id == current_user.id).all()
    }

    async def suggest_one(merchant: str, group_txns: list[Transaction]) -> QAPendingOut:
        async with _suggest_sem:
            suggestion = await suggest_category(
                merchant,
                group_txns[0].description,
                current_user.id,
                db,
                ai_client,
            )
        cat = cats_by_id.get(suggestion.get("category_id"))
        return QAPendingOut(
            merchant_name=merchant,
            sample_description=group_txns[0].description,
            transaction_count=len(group_txns),
            total_amount=float(sum(t.amount for t in group_txns)),
            transaction_ids=[t.id for t in group_txns],
            suggested_category_id=suggestion.get("category_id"),
            suggested_category_name=cat.name if cat else None,
            suggested_confidence=suggestion.get("confidence"),
            suggested_new_category=suggestion.get("suggested_new_category"),
        )

    result = await asyncio.gather(*[
        suggest_one(merchant, group_txns)
        for merchant, group_txns in groups.items()
    ])
    return list(result)


def _fetch_qa_txns(body_merchant: str, body_ids: list[int] | None, user_id: int, db: Session) -> list[Transaction]:
    """Fetch transactions for a QA action. Prefer explicit IDs; fall back to merchant name match."""
    q = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.is_categorized == False,
    )
    if body_ids:
        q = q.filter(Transaction.id.in_(body_ids))
    else:
        q = q.filter(
            (Transaction.merchant_name == body_merchant) |
            (Transaction.description == body_merchant)
        )
    return q.all()


@router.post("/answer")
def answer_qa(body: QAAnswer, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    txns = _fetch_qa_txns(body.merchant_name, body.transaction_ids, current_user.id, db)

    for t in txns:
        t.category_id = body.category_id
        t.is_categorized = True

    if body.apply_rule:
        existing = db.query(MerchantRule).filter(
            MerchantRule.user_id == current_user.id,
            MerchantRule.pattern == body.merchant_name,
        ).first()
        if not existing:
            rule = MerchantRule(
                user_id=current_user.id,
                pattern=body.merchant_name,
                pattern_type="contains",
                category_id=body.category_id,
                priority=0,
            )
            db.add(rule)

    db.commit()
    return {"data": {"updated": len(txns)}}


@router.post("/skip")
def skip_qa(body: QASkip, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    uncategorized = db.query(Category).filter(
        Category.user_id == current_user.id, Category.name == "Uncategorized"
    ).first()

    txns = _fetch_qa_txns(body.merchant_name, body.transaction_ids, current_user.id, db)

    for t in txns:
        t.category_id = uncategorized.id if uncategorized else None
        t.is_categorized = True

    db.commit()
    return {"data": {"skipped": len(txns)}}


@router.post("/answer-batch")
def answer_batch(answers: list[QAAnswer], current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    total = 0
    for answer in answers:
        txns = _fetch_qa_txns(answer.merchant_name, answer.transaction_ids, current_user.id, db)
        for t in txns:
            t.category_id = answer.category_id
            t.is_categorized = True
        total += len(txns)
    db.commit()
    return {"data": {"updated": total}}
