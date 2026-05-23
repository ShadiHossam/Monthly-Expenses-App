from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date


class SummaryOut(BaseModel):
    total_debits: float
    total_credits: float
    net: float
    transaction_count: int
    opening_balance: Optional[float]
    closing_balance: Optional[float]
    top_categories: List[Dict]
    biggest_expense: Optional[Dict]


class MonthDataOut(BaseModel):
    month: int
    month_label: str
    total_debits: float
    total_credits: float
    net: float
    transaction_count: int
    by_category: Dict[str, float]


class QuarterDataOut(BaseModel):
    quarter: int
    label: str
    total_debits: float
    total_credits: float
    net: float
    months: List[MonthDataOut]


class CategoryBreakdownItem(BaseModel):
    category_id: Optional[int]
    category_name: str
    color: str
    total: float
    percentage: float
    transaction_count: int


class FrequentPlaceOut(BaseModel):
    merchant_name: str
    visit_count: int
    total_spend: float
    avg_spend: float
    last_visit: date
    frequency_reason: str


class QAPendingOut(BaseModel):
    merchant_name: str
    sample_description: str
    transaction_count: int
    total_amount: float
    transaction_ids: List[int]
    suggested_category_id: Optional[int]
    suggested_category_name: Optional[str]
    suggested_confidence: Optional[float]
    suggested_new_category: Optional[Dict]


class QAAnswer(BaseModel):
    merchant_name: str
    category_id: int
    apply_rule: bool = False
    transaction_ids: Optional[List[int]] = None


class QASkip(BaseModel):
    merchant_name: str
    transaction_ids: Optional[List[int]] = None
