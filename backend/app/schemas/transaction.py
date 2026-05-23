from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class TransactionOut(BaseModel):
    id: int
    statement_id: int
    txn_date: date
    ref_number: Optional[str]
    description: str
    merchant_name: Optional[str]
    amount: float
    txn_type: str
    balance_after: Optional[float]
    category_id: Optional[int]
    is_categorized: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryPatch(BaseModel):
    category_id: int


class BulkCategorize(BaseModel):
    transaction_ids: list[int]
    category_id: int
