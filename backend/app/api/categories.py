import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models.category import Category, MerchantRule
from app.models.statement import Transaction
from app.schemas.category import (
    CategoryCreate, CategoryUpdate, CategoryOut,
    MerchantRuleCreate, MerchantRuleUpdate, MerchantRuleOut, RuleTestRequest,
)
from app.services.ai.categorizer import suggest_new_category_for_merchant
from app.services.ai.client import ai_client
from app.services.ai.context import set_user_ai_context


class AISuggestRequest(BaseModel):
    merchant_name: str
    description: str = ""

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    cats = db.query(Category).filter(Category.user_id == current_user.id).all()
    cat_ids = [c.id for c in cats]
    counts: dict[int, int] = dict(
        db.query(Transaction.category_id, func.count(Transaction.id))
        .filter(Transaction.category_id.in_(cat_ids))
        .group_by(Transaction.category_id)
        .all()
    )
    return [
        CategoryOut(
            id=c.id, name=c.name, color=c.color, icon=c.icon,
            is_system=c.is_system, transaction_count=counts.get(c.id, 0),
        )
        for c in cats
    ]


@router.post("/categories", response_model=CategoryOut)
def create_category(body: CategoryCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    cat = Category(user_id=current_user.id, name=body.name, color=body.color, icon=body.icon)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut(id=cat.id, name=cat.name, color=cat.color, icon=cat.icon, is_system=cat.is_system)


@router.patch("/categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, body: CategoryUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if body.name and cat.is_system:
        raise HTTPException(status_code=403, detail="Cannot rename system categories")
    if body.name:
        cat.name = body.name
    if body.color:
        cat.color = body.color
    if body.icon:
        cat.icon = body.icon
    db.commit()
    db.refresh(cat)
    count = db.query(func.count(Transaction.id)).filter(Transaction.category_id == cat.id).scalar() or 0
    return CategoryOut(id=cat.id, name=cat.name, color=cat.color, icon=cat.icon, is_system=cat.is_system, transaction_count=count)


@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(cat_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system categories")
    # Reassign transactions to Uncategorized
    uncategorized = db.query(Category).filter(
        Category.user_id == current_user.id, Category.name == "Uncategorized"
    ).first()
    db.query(Transaction).filter(Transaction.category_id == cat_id).update(
        {"category_id": uncategorized.id if uncategorized else None}
    )
    db.delete(cat)
    db.commit()


@router.post("/categories/ai-suggest")
async def ai_suggest_category(body: AISuggestRequest, current_user=Depends(get_current_user)):
    set_user_ai_context(current_user)
    suggestion = await suggest_new_category_for_merchant(body.merchant_name, body.description, ai_client)
    return {"data": suggestion}


# Merchant Rules
@router.get("/merchant-rules", response_model=list[MerchantRuleOut])
def list_rules(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(MerchantRule).filter(MerchantRule.user_id == current_user.id).order_by(MerchantRule.priority.desc()).all()


@router.post("/merchant-rules", response_model=MerchantRuleOut)
def create_rule(body: MerchantRuleCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == body.category_id, Category.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    rule = MerchantRule(user_id=current_user.id, **body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/merchant-rules/{rule_id}", response_model=MerchantRuleOut)
def update_rule(rule_id: int, body: MerchantRuleUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    rule = db.query(MerchantRule).filter(MerchantRule.id == rule_id, MerchantRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(rule, field, val)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/merchant-rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    rule = db.query(MerchantRule).filter(MerchantRule.id == rule_id, MerchantRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()


@router.post("/merchant-rules/test")
def test_rule(body: RuleTestRequest):
    text = body.sample_text.lower()
    pattern = body.pattern.lower()
    if body.pattern_type == "contains":
        matched = pattern in text
    elif body.pattern_type == "startswith":
        matched = text.startswith(pattern)
    elif body.pattern_type == "regex":
        try:
            matched = bool(re.search(pattern, text))
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regex: {e}")
    else:
        matched = False
    return {"data": {"matched": matched}}
