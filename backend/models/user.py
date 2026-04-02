"""User ORM model."""

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, Text
from database import Base


class User(Base):
    """Represents an authenticated user of the system."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(Text, nullable=False, unique=True)
    hashed_password = Column(Text, nullable=False)
    full_name = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
