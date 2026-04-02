"""Pydantic schemas for the unified Documents endpoint."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """Full document object returned by API."""

    id: int
    user_id: int
    filename: str
    upload_date: datetime
    document_type: Optional[str] = None
    extracted_json: Optional[str] = None

    # Faktura fields
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    base_amount: Optional[float] = None
    vat_rate: Optional[float] = None
    vat_amount: Optional[float] = None
    total_amount: Optional[float] = None

    # Racun fields
    store_name: Optional[str] = None
    receipt_date: Optional[str] = None

    # Putni nalog fields
    employee_name: Optional[str] = None
    destination: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    purpose: Optional[str] = None

    status: str
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}
