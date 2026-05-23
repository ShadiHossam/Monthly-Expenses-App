from sqlalchemy import Column, Integer, String, DateTime, func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id                  = Column(Integer, primary_key=True, index=True)
    username            = Column(String, unique=True, nullable=False, index=True)
    email               = Column(String, unique=True, nullable=True)
    password_hash       = Column(String, nullable=False)
    created_at          = Column(DateTime, default=func.now())
    groq_api_key           = Column(String, nullable=True)
    openrouter_api_key     = Column(String, nullable=True)
    anthropic_api_key      = Column(String, nullable=True)
    ai_provider            = Column(String, default="auto")
    concurrent_processing  = Column(Integer, default=2)
