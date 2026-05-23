from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id                      = Column(Integer, primary_key=True, index=True)
    user_id                 = Column(Integer, nullable=False, unique=True, index=True)
    plan                    = Column(String, nullable=False, default="free")  # free|solo|pro|business
    stripe_customer_id      = Column(String, nullable=True, index=True)
    stripe_subscription_id  = Column(String, nullable=True)
    pages_used              = Column(Integer, nullable=False, default=0)
    pages_limit             = Column(Integer, nullable=False, default=15)
    current_period_start    = Column(DateTime, nullable=True)
    current_period_end      = Column(DateTime, nullable=True)
    status                  = Column(String, nullable=False, default="active")  # active|past_due|canceled
    overage_enabled         = Column(Boolean, nullable=False, default=False)
    created_at              = Column(DateTime, default=func.now())
    updated_at              = Column(DateTime, default=func.now(), onupdate=func.now())
