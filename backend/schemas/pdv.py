"""Pydantic schemas for PDV (VAT) Assistant endpoints."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class PdvInvoiceResponse(BaseModel):
    """Full PDV invoice object returned by API."""

    id: int
    user_id: int
    filename: str
    upload_date: datetime
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    base_amount: Optional[float] = None
    vat_rate: Optional[float] = None
    vat_amount: Optional[float] = None
    total_amount: Optional[float] = None
    status: str
    error_message: Optional[str] = None
    avans_faktura_id: Optional[int] = None
    datum_placanja: Optional[date] = None
    napomena: Optional[str] = None

    model_config = {"from_attributes": True}


class PdvInvoiceStatusUpdate(BaseModel):
    """Schema for PATCH /api/pdv/invoices/{id}/status."""

    status: str
    datum_placanja: Optional[date] = None
    avans_faktura_id: Optional[int] = None
    napomena: Optional[str] = None
    invoice_date: Optional[str] = None  # Allow manual override if OCR missed it


class VatReportResponse(BaseModel):
    """Aggregated VAT report for a given period."""

    id: int
    user_id: int
    period_month: int
    period_year: int
    total_base_20: float
    total_vat_20: float
    total_base_10: float
    total_vat_10: float
    total_base: float
    total_vat: float
    total_with_vat: float
    total_avans_base: float
    total_avans_vat: float
    generated_at: datetime

    model_config = {"from_attributes": True}
