from sqlalchemy import Column, Integer, Numeric, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base

class BudgetAlert(Base):
    __tablename__ = "budget_alerts"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    monthly_limit = Column(Numeric(12, 2), nullable=False)
    enabled     = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=func.now())
    updated_at  = Column(DateTime, default=func.now(), onupdate=func.now())
    category    = relationship("Category")
