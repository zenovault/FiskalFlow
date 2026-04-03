"""Invoice ORM model."""

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Text
from database import Base


class Invoice(Base):
    """Represents a processed invoice document."""

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_filename = Column(Text, nullable=False)
    stored_filename = Column(Text, nullable=False)         # UUID-based filename on disk
    raw_ocr_text = Column(Text, nullable=True)
    extracted_json = Column(Text, nullable=True)           # Full JSON from LLM
    confidence = Column(Float, nullable=True)              # 0.0 to 1.0
    document_type = Column(Text, nullable=True)            # faktura, gotovinski_racun, putni_nalog, ostalo
    invoice_number = Column(Text, nullable=True)
    issue_date = Column(Text, nullable=True)               # YYYY-MM-DD string
    issuer_name = Column(Text, nullable=True)
    issuer_pib = Column(Text, nullable=True)
    total_amount = Column(Float, nullable=True)
    vat_amount = Column(Float, nullable=True)
    currency = Column(Text, default="RSD")
    processing_status = Column(Text, nullable=False, default="pending")
                                                           # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    manually_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- Fiscal receipt fields (Patch 1) ---
    esir_broj = Column(Text, nullable=True)                # ESIR/ECIP broj
    pfr_broj = Column(Text, nullable=True)                 # PFR broj računa
    brojac_racuna = Column(Text, nullable=True)            # Brojač računa
    kasir = Column(Text, nullable=True)                    # Kasir name
    adresa_izdavaoca = Column(Text, nullable=True)         # Full address of issuer
    vreme_transakcije = Column(Text, nullable=True)        # Full PFR timestamp

    # Payment fields
    gotovina = Column(Float, nullable=True)                # Cash paid
    povracaj = Column(Float, nullable=True)                # Change returned
    nacin_placanja_detalj = Column(Text, nullable=True)    # gotovina|kartica|bezgotovinsko|kombinovano

    # VAT breakdown (separate rates)
    pdv_stopa_e = Column(Float, nullable=True)             # П-ПДВ stopa (10%)
    pdv_iznos_e = Column(Float, nullable=True)             # PDV iznos po stopi E
    pdv_stopa_dj = Column(Float, nullable=True)            # О-ПДВ stopa (20%)
    pdv_iznos_dj = Column(Float, nullable=True)            # PDV iznos po stopi Đ
    pdv_stopa_a = Column(Float, nullable=True)             # Oslobođeno stopa (0%)
    pdv_iznos_a = Column(Float, nullable=True)

    # Item count
    broj_artikala = Column(Integer, nullable=True)

    # --- Confidence score (Patch 4 — raw 0-100 pytesseract score) ---
    confidence_score = Column(Float, nullable=True)

    # --- Accounting fields (Patch 3) ---
    interni_broj = Column(Text, nullable=True)               # Internal reference / work order number
    tip_fakture = Column(Text, nullable=True, default="ulazna")  # "ulazna" | "izlazna"
    avans_primljen = Column(Float, nullable=True)            # Advance payment received
    avans_opravdan = Column(Float, nullable=True)            # Advance payment justified
    avans_datum_primanja = Column(Text, nullable=True)       # YYYY-MM-DD
    avans_datum_opravdanja = Column(Text, nullable=True)     # YYYY-MM-DD
