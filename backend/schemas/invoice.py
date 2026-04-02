"""Pydantic schemas for invoice-related requests and responses."""

import json
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field, computed_field, model_validator


class InvoiceUpdate(BaseModel):
    """Schema for PATCH /api/invoices/{id} — all fields optional for partial update."""

    invoice_number: Optional[str] = Field(None, max_length=100)
    issue_date: Optional[str] = Field(None, max_length=10)
    issuer_name: Optional[str] = Field(None, max_length=255)
    issuer_pib: Optional[str] = Field(None, max_length=20)
    total_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    currency: Optional[str] = Field(None, max_length=3)
    document_type: Optional[str] = Field(None, max_length=50)
    manually_verified: Optional[bool] = None
    interni_broj: Optional[str] = Field(None, max_length=100)
    tip_fakture: Optional[str] = Field(None, pattern="^(ulazna|izlazna)$")
    avans_primljen: Optional[float] = Field(None, ge=0)
    avans_opravdan: Optional[float] = Field(None, ge=0)
    avans_datum_primanja: Optional[str] = None
    avans_datum_opravdanja: Optional[str] = None


class PDVBreakdownItem(BaseModel):
    """Single VAT rate row from pdv_breakdown."""

    oznaka: Optional[str] = None
    ime: Optional[str] = None
    stopa: Optional[float] = None
    iznos: Optional[float] = None


class StavkaItem(BaseModel):
    """Single line item from an invoice or receipt."""

    naziv: str
    cena: Optional[float] = None
    kolicina: Optional[float] = None
    pdv_oznaka: Optional[str] = None
    iznos: Optional[float] = None


class InvoiceResponse(BaseModel):
    """Full invoice object returned by API endpoints."""

    id: int
    user_id: int
    original_filename: str
    stored_filename: str
    raw_ocr_text: Optional[str] = None
    extracted_json: Optional[str] = None
    confidence: Optional[float] = None
    document_type: Optional[str] = None
    invoice_number: Optional[str] = None
    issue_date: Optional[str] = None
    issuer_name: Optional[str] = None
    issuer_pib: Optional[str] = None
    total_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    currency: Optional[str] = None
    processing_status: str
    error_message: Optional[str] = None
    manually_verified: bool = False
    created_at: datetime
    updated_at: datetime

    # Patch 1 fields — from DB columns
    esir_broj: Optional[str] = None
    pfr_broj: Optional[str] = None
    brojac_racuna: Optional[str] = None
    kasir: Optional[str] = None
    adresa_izdavaoca: Optional[str] = None
    vreme_transakcije: Optional[str] = None
    gotovina: Optional[float] = None
    povracaj: Optional[float] = None
    nacin_placanja_detalj: Optional[str] = None
    pdv_stopa_e: Optional[float] = None
    pdv_iznos_e: Optional[float] = None
    pdv_stopa_dj: Optional[float] = None
    pdv_iznos_dj: Optional[float] = None
    broj_artikala: Optional[int] = None

    # Patch 3 — accounting fields
    interni_broj: Optional[str] = None
    tip_fakture: Optional[str] = "ulazna"
    avans_primljen: Optional[float] = None
    avans_opravdan: Optional[float] = None
    avans_datum_primanja: Optional[str] = None
    avans_datum_opravdanja: Optional[str] = None

    # Derived from extracted_json — populated by validator below
    pdv_breakdown: List[PDVBreakdownItem] = []
    stavke: List[StavkaItem] = []
    ukupan_pdv: Optional[float] = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def preostalo_za_naplatu(self) -> Optional[float]:
        if self.total_amount is None:
            return None
        avans = self.avans_primljen or 0
        return round(self.total_amount - avans, 2)

    @model_validator(mode="after")
    def _populate_from_json(self) -> "InvoiceResponse":
        """Parse extracted_json to populate nested fields not stored as separate columns."""
        if not self.extracted_json:
            return self
        try:
            data = json.loads(self.extracted_json)
        except (json.JSONDecodeError, TypeError):
            return self

        if not self.pdv_breakdown:
            raw_breakdown = data.get("pdv_breakdown") or []
            self.pdv_breakdown = [PDVBreakdownItem(**item) for item in raw_breakdown if isinstance(item, dict)]

        if not self.stavke:
            raw_stavke = data.get("stavke") or []
            parsed = []
            for item in raw_stavke:
                if isinstance(item, dict):
                    # Handle both old (opis) and new (naziv) key names
                    if "opis" in item and "naziv" not in item:
                        item["naziv"] = item.pop("opis")
                    if "naziv" in item:
                        parsed.append(StavkaItem(**{k: v for k, v in item.items() if k in StavkaItem.model_fields}))
            self.stavke = parsed

        if self.ukupan_pdv is None:
            self.ukupan_pdv = data.get("ukupan_pdv")

        return self


class PaginatedInvoices(BaseModel):
    """Paginated list of invoices."""

    items: list[InvoiceResponse]
    total: int
    page: int
    per_page: int
    pages: int


class InvoiceStats(BaseModel):
    """Aggregated statistics for the authenticated user's invoices."""

    total_count: int
    total_amount_month: float
    total_pdv_month: float
    pending_verification: int
    top_issuer: Optional[str] = None
    top_issuer_count: int
    avg_confidence: float
