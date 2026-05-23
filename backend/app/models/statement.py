from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Float, ForeignKey, Numeric, Text, JSON, Index, CheckConstraint, func
from sqlalchemy.orm import relationship
from app.database import Base


class Statement(Base):
    __tablename__ = "statements"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename        = Column(String)
    image_path      = Column(String)
    period_start    = Column(Date)
    period_end      = Column(Date)
    opening_balance = Column(Numeric(12, 2))
    closing_balance = Column(Numeric(12, 2))
    verify_status   = Column(String, default="pending")  # pending|passed|failed|flagged
    verify_errors   = Column(JSON, nullable=True)
    confidence      = Column(Float, nullable=True)
    ocr_engine      = Column(String, default="paddle")
    raw_ocr_text    = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=func.now())

    transactions = relationship("Transaction", back_populates="statement", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    statement_id  = Column(Integer, ForeignKey("statements.id"), nullable=False)
    txn_date      = Column(Date, nullable=False)
    ref_number    = Column(String, nullable=True)
    description   = Column(String, nullable=False)
    merchant_name = Column(String, nullable=True)
    amount        = Column(Numeric(12, 2), nullable=False)
    txn_type      = Column(String, nullable=False)   # debit | credit
    balance_after = Column(Numeric(12, 2), nullable=True)
    category_id   = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_categorized = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=func.now())

    statement = relationship("Statement", back_populates="transactions")
    category  = relationship("Category", back_populates="transactions")

    __table_args__ = (
        Index("ix_txn_user_date", "user_id", "txn_date"),
        Index("ix_txn_merchant", "user_id", "merchant_name"),
        Index("ix_txn_category", "user_id", "category_id"),
        CheckConstraint("txn_type IN ('debit', 'credit')", name="ck_txn_type"),
    )
