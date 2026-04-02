"""PDV Invoice ORM model — stores extracted VAT invoice data."""

from datetime import datetime
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, Text
from database import Base

# Valid accounting statuses
# primljen  — invoice received, not yet processed
# avans     — advance payment, VAT calculated immediately
# opravdan  — advance justified by delivery, linked to final invoice
# placeno   — invoice paid, payment recorded
# pdv       — invoice entered into VAT records, ready for POPDV
VALID_STATUSES = ("primljen", "avans", "opravdan", "placeno", "pdv")


class PdvInvoice(Base):
    """Represents a PDV (VAT) invoice processed through the PDV Assistant."""

    __tablename__ = "pdv_invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(Text, nullable=False)
    stored_filename = Column(Text, nullable=False)
    upload_date = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Extracted fields
    vendor_name = Column(Text, nullable=True)
    invoice_number = Column(Text, nullable=True)
    invoice_date = Column(Text, nullable=True)        # YYYY-MM-DD
    base_amount = Column(Float, nullable=True)
    vat_rate = Column(Float, nullable=True)           # 0.10 or 0.20
    vat_amount = Column(Float, nullable=True)
    total_amount = Column(Float, nullable=True)

    # Accounting status (Serbian workflow)
    status = Column(Text, nullable=False, default="primljen")

    # OCR/processing error message
    error_message = Column(Text, nullable=True)

    # Link to original avans invoice (used when status == "opravdan")
    avans_faktura_id = Column(Integer, ForeignKey("pdv_invoices.id"), nullable=True)

    # Date payment was recorded (filled when status becomes "placeno")
    datum_placanja = Column(Date, nullable=True)

    # Free text note
    napomena = Column(Text, nullable=True)
