"""VatReport ORM model — stores aggregated VAT report data per period."""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer
from database import Base


class VatReport(Base):
    """Aggregated VAT report for a given month/year period."""

    __tablename__ = "vat_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)

    # 20% VAT group
    total_base_20 = Column(Float, nullable=False, default=0.0)
    total_vat_20 = Column(Float, nullable=False, default=0.0)

    # 10% VAT group
    total_base_10 = Column(Float, nullable=False, default=0.0)
    total_vat_10 = Column(Float, nullable=False, default=0.0)

    # Grand totals
    total_base = Column(Float, nullable=False, default=0.0)
    total_vat = Column(Float, nullable=False, default=0.0)
    total_with_vat = Column(Float, nullable=False, default=0.0)

    # Advance (avans) totals — invoices with status "avans" not yet opravdan
    total_avans_base = Column(Float, nullable=False, default=0.0)
    total_avans_vat = Column(Float, nullable=False, default=0.0)

    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
