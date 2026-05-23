from pydantic import BaseModel
from typing import Optional


class CategoryCreate(BaseModel):
    name: str
    color: str = "#6b7280"
    icon: str = "tag"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    color: str
    icon: str
    is_system: bool
    transaction_count: int = 0

    class Config:
        from_attributes = True


class MerchantRuleCreate(BaseModel):
    pattern: str
    pattern_type: str = "contains"
    category_id: int
    priority: int = 0


class MerchantRuleUpdate(BaseModel):
    pattern: Optional[str] = None
    pattern_type: Optional[str] = None
    category_id: Optional[int] = None
    priority: Optional[int] = None


class MerchantRuleOut(BaseModel):
    id: int
    pattern: str
    pattern_type: str
    category_id: int
    priority: int

    class Config:
        from_attributes = True


class RuleTestRequest(BaseModel):
    pattern: str
    pattern_type: str
    sample_text: str
