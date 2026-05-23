from sqlalchemy import Column, Integer, String, DateTime, func
from app.database import Base


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, nullable=False, index=True)
    statement_id    = Column(Integer, nullable=True)
    pages_consumed  = Column(Integer, nullable=False, default=1)
    action          = Column(String, nullable=False, default="upload")  # upload|manual
    created_at      = Column(DateTime, default=func.now())
