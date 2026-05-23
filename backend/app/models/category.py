from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name      = Column(String, nullable=False)
    color     = Column(String, default="#6b7280")
    icon      = Column(String, default="tag")
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    transactions = relationship("Transaction", back_populates="category")
    rules        = relationship("MerchantRule", back_populates="category", cascade="all, delete-orphan")


class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    pattern      = Column(String, nullable=False)
    pattern_type = Column(String, default="contains")  # contains | startswith | regex
    category_id  = Column(Integer, ForeignKey("categories.id"), nullable=False)
    priority     = Column(Integer, default=0)
    created_at   = Column(DateTime, default=func.now())

    category = relationship("Category", back_populates="rules")
