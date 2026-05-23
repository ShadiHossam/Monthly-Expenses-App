from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class StatementOut(BaseModel):
    id: int
    filename: Optional[str]
    period_start: Optional[date]
    period_end: Optional[date]
    opening_balance: Optional[float]
    closing_balance: Optional[float]
    verify_status: str
    verify_errors: Optional[List[str]]
    confidence: Optional[float]
    ocr_engine: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatementDetail(StatementOut):
    transactions: List["TransactionOut"] = []


from app.schemas.transaction import TransactionOut
StatementDetail.model_rebuild()
