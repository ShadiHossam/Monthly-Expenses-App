from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from app.database import Base


class MerchantAlias(Base):
    __tablename__ = "merchant_aliases"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    raw_name     = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    created_at   = Column(DateTime, default=func.now())
