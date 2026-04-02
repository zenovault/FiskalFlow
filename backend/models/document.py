"""Unified Document ORM model — stores any uploaded document regardless of type."""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Text
from database import Base

# document_type values: 'faktura', 'racun', 'putni_nalog', 'nepoznato'
VALID_DOC_TYPES = ("faktura", "racun", "putni_nalog", "nepoznato")


class Document(Base):
    """Represents any uploaded and processed document (invoice, receipt, travel order)."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(Text, nullable=False)
    stored_filename = Column(Text, nullable=False)
    upload_date = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Detected document type
    document_type = Column(Text, nullable=True)   # faktura / racun / putni_nalog / nepoznato

    # Raw OCR and LLM output
    raw_ocr_text = Column(Text, nullable=True)
    extracted_json = Column(Text, nullable=True)  # Full JSON string from LLM

    # ── Fields for FAKTURA ──────────────────────────────────────────────────
    vendor_name = Column(Text, nullable=True)
    invoice_number = Column(Text, nullable=True)
    invoice_date = Column(Text, nullable=True)    # YYYY-MM-DD
    base_amount = Column(Float, nullable=True)
    vat_rate = Column(Float, nullable=True)       # 0.10 or 0.20
    vat_amount = Column(Float, nullable=True)
    total_amount = Column(Float, nullable=True)

    # ── Fields for RACUN (retail receipt) ───────────────────────────────────
    store_name = Column(Text, nullable=True)
    receipt_date = Column(Text, nullable=True)    # YYYY-MM-DD

    # ── Fields for PUTNI NALOG (travel order) ───────────────────────────────
    employee_name = Column(Text, nullable=True)
    destination = Column(Text, nullable=True)
    date_from = Column(Text, nullable=True)       # YYYY-MM-DD
    date_to = Column(Text, nullable=True)         # YYYY-MM-DD
    purpose = Column(Text, nullable=True)

    # Processing
    status = Column(Text, nullable=False, default="pending")  # pending / completed / error
    error_message = Column(Text, nullable=True)
