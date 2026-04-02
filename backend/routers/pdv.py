"""
PDV (VAT) Assistant router — invoice upload, listing, status update,
report generation, and CSV export.
All endpoints require JWT authentication. Users only see their own data.
"""

import csv
import io
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

import ollama
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.pdv_invoice import PdvInvoice, VALID_STATUSES
from models.vat_report import VatReport
from models.user import User
from schemas.pdv import PdvInvoiceResponse, PdvInvoiceStatusUpdate, VatReportResponse
from services.auth_service import get_current_user
from services.ocr_service import extract_text
from utils.validators import validate_and_read_upload

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/pdv", tags=["PDV"])

# Statuses included in POPDV totals
POPDV_STATUSES = ("pdv", "placeno")

PDV_SYSTEM_PROMPT = """You are a PDV (VAT) invoice data extraction engine for Serbian accounting documents.

Extract data from the OCR text and return ONLY a valid JSON object. No explanation. No markdown. Just JSON.

Required JSON structure:
{
  "vendor_name": "company name or null",
  "invoice_number": "invoice number string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "base_amount": number or null,
  "vat_rate": 0.10 or 0.20 or null,
  "vat_amount": number or null,
  "total_amount": number or null
}

Rules:
- vat_rate must be exactly 0.10 (for 10%) or 0.20 (for 20%), never 10 or 20
- All amounts must be numbers (not strings), use dot as decimal separator
- If vat_rate cannot be determined but vat_amount and base_amount are known, calculate it
- Convert any date format to YYYY-MM-DD
- If a field cannot be determined, use null
- Remove thousand separators from amounts, convert comma decimal to dot decimal"""


def _extract_pdv_fields(raw_ocr_text: str) -> dict:
    """Send OCR text to Ollama and return PDV invoice fields."""
    if not raw_ocr_text or len(raw_ocr_text.strip()) < 10:
        return _empty_pdv()

    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    try:
        client = ollama.Client(host=ollama_url)
        response = client.chat(
            model=model,
            messages=[
                {"role": "system", "content": PDV_SYSTEM_PROMPT},
                {"role": "user", "content": f"Extract PDV data from this OCR text:\n\n{raw_ocr_text}"},
            ],
            options={"temperature": 0.0, "top_p": 0.9, "num_predict": 512},
        )
        text = response["message"]["content"].strip()
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise ValueError("No JSON in LLM response")
        data = json.loads(match.group())
        return _clean_pdv(data)
    except ollama.ResponseError as e:
        logger.error("Ollama error: %s", e)
        raise RuntimeError("LLM servis nije dostupan. Da li je Ollama pokrenut?")
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s", e)
        return _empty_pdv()
    except Exception as e:
        logger.error("PDV LLM extraction failed: %s", e)
        raise RuntimeError(str(e))


def _clean_pdv(data: dict) -> dict:
    """Validate and clean LLM response fields."""
    fields = ["vendor_name", "invoice_number", "invoice_date",
              "base_amount", "vat_rate", "vat_amount", "total_amount"]
    for f in fields:
        if f not in data:
            data[f] = None

    if data.get("vat_rate") not in (0.10, 0.20, None):
        vr = data["vat_rate"]
        if vr in (10, 10.0):
            data["vat_rate"] = 0.10
        elif vr in (20, 20.0):
            data["vat_rate"] = 0.20
        else:
            data["vat_rate"] = None

    for f in ("base_amount", "vat_amount", "total_amount"):
        if data[f] is not None:
            try:
                data[f] = float(data[f])
            except (ValueError, TypeError):
                data[f] = None

    return data


def _empty_pdv() -> dict:
    return {
        "vendor_name": None,
        "invoice_number": None,
        "invoice_date": None,
        "base_amount": None,
        "vat_rate": None,
        "vat_amount": None,
        "total_amount": None,
    }


def _get_invoice_or_404(invoice_id: int, user_id: int, db: Session) -> PdvInvoice:
    inv = db.query(PdvInvoice).filter(
        PdvInvoice.id == invoice_id,
        PdvInvoice.user_id == user_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail={"error": "Faktura nije pronađena", "code": "NOT_FOUND"})
    return inv


# ─── Upload ──────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=PdvInvoiceResponse, status_code=201)
@limiter.limit("20/minute")
async def upload_pdv_invoice(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an invoice image for PDV processing. Runs OCR + AI extraction."""
    content, safe_name = await validate_and_read_upload(file)

    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / safe_name
    file_path.write_bytes(content)

    invoice = PdvInvoice(
        user_id=current_user.id,
        filename=Path(file.filename or "upload").name,
        stored_filename=safe_name,
        status="primljen",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    try:
        ocr_result = extract_text(str(file_path))
        raw_text = ocr_result["raw_text"]
        fields = _extract_pdv_fields(raw_text)

        invoice.vendor_name = fields.get("vendor_name")
        invoice.invoice_number = fields.get("invoice_number")
        invoice.invoice_date = fields.get("invoice_date")
        invoice.base_amount = fields.get("base_amount")
        invoice.vat_rate = fields.get("vat_rate")
        invoice.vat_amount = fields.get("vat_amount")
        invoice.total_amount = fields.get("total_amount")
        # Keep status as "primljen" — user must manually advance it

        db.commit()
        db.refresh(invoice)
        logger.info("PDV invoice %d processed for user %d", invoice.id, current_user.id)

    except Exception as e:
        logger.error("PDV processing failed for invoice %d: %s", invoice.id, e)
        invoice.error_message = str(e)
        db.commit()
        db.refresh(invoice)
        raise HTTPException(
            status_code=422,
            detail={"error": "Obrada fakture nije uspela", "code": "PROCESSING_FAILED", "detail": str(e)},
        )

    return PdvInvoiceResponse.model_validate(invoice)


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=list[PdvInvoiceResponse])
@limiter.limit("60/minute")
async def list_pdv_invoices(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all PDV invoices for the authenticated user."""
    invoices = (
        db.query(PdvInvoice)
        .filter(PdvInvoice.user_id == current_user.id)
        .order_by(PdvInvoice.upload_date.desc())
        .all()
    )
    return [PdvInvoiceResponse.model_validate(inv) for inv in invoices]


# ─── Status update ────────────────────────────────────────────────────────────

@router.patch("/invoices/{invoice_id}/status", response_model=PdvInvoiceResponse)
@limiter.limit("60/minute")
async def update_invoice_status(
    request: Request,
    invoice_id: int,
    body: PdvInvoiceStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the accounting status of a PDV invoice.
    - When status = 'placeno', datum_placanja is required.
    - When status = 'opravdan', avans_faktura_id links to the original avans invoice.
    """
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail={"error": f"Nevažeći status. Dozvoljeno: {', '.join(VALID_STATUSES)}", "code": "INVALID_STATUS"},
        )

    invoice = _get_invoice_or_404(invoice_id, current_user.id, db)

    invoice.status = body.status

    if body.status == "placeno" and body.datum_placanja:
        invoice.datum_placanja = body.datum_placanja

    if body.status == "opravdan" and body.avans_faktura_id is not None:
        # Verify the avans invoice belongs to this user
        avans = db.query(PdvInvoice).filter(
            PdvInvoice.id == body.avans_faktura_id,
            PdvInvoice.user_id == current_user.id,
            PdvInvoice.status == "avans",
        ).first()
        if not avans:
            raise HTTPException(
                status_code=400,
                detail={"error": "Avans faktura nije pronađena", "code": "AVANS_NOT_FOUND"},
            )
        invoice.avans_faktura_id = body.avans_faktura_id

    if body.napomena is not None:
        invoice.napomena = body.napomena

    if body.invoice_date is not None:
        invoice.invoice_date = body.invoice_date

    db.commit()
    db.refresh(invoice)
    logger.info("PDV invoice %d status → %s by user %d", invoice_id, body.status, current_user.id)
    return PdvInvoiceResponse.model_validate(invoice)


# ─── Report ───────────────────────────────────────────────────────────────────

@router.get("/report", response_model=VatReportResponse)
@limiter.limit("30/minute")
async def get_vat_report(
    request: Request,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Aggregate PDV invoices for the given period.
    Only includes invoices with status 'pdv' or 'placeno' in POPDV totals.
    Also computes outstanding avans (avans invoices not yet opravdan).
    """
    month_str = f"{year}-{month:02d}"

    # POPDV invoices — only pdv + placeno, filtered by invoice_date
    # If invoice_date is null, include anyway
    popdv_invoices = (
        db.query(PdvInvoice)
        .filter(
            PdvInvoice.user_id == current_user.id,
            PdvInvoice.status.in_(POPDV_STATUSES),
            (PdvInvoice.invoice_date.like(f"{month_str}%")) | (PdvInvoice.invoice_date.is_(None)),
        )
        .all()
    )

    total_base_20 = total_vat_20 = total_base_10 = total_vat_10 = 0.0
    for inv in popdv_invoices:
        base = inv.base_amount or 0.0
        vat = inv.vat_amount or 0.0
        if inv.vat_rate == 0.20:
            total_base_20 += base
            total_vat_20 += vat
        elif inv.vat_rate == 0.10:
            total_base_10 += base
            total_vat_10 += vat

    total_base = total_base_20 + total_base_10
    total_vat = total_vat_20 + total_vat_10
    total_with_vat = total_base + total_vat

    # Avans invoices not yet opravdan (all periods, not just current month)
    avans_invoices = (
        db.query(PdvInvoice)
        .filter(
            PdvInvoice.user_id == current_user.id,
            PdvInvoice.status == "avans",
        )
        .all()
    )
    total_avans_base = sum(inv.base_amount or 0.0 for inv in avans_invoices)
    total_avans_vat = sum(inv.vat_amount or 0.0 for inv in avans_invoices)

    report = VatReport(
        user_id=current_user.id,
        period_month=month,
        period_year=year,
        total_base_20=round(total_base_20, 2),
        total_vat_20=round(total_vat_20, 2),
        total_base_10=round(total_base_10, 2),
        total_vat_10=round(total_vat_10, 2),
        total_base=round(total_base, 2),
        total_vat=round(total_vat, 2),
        total_with_vat=round(total_with_vat, 2),
        total_avans_base=round(total_avans_base, 2),
        total_avans_vat=round(total_avans_vat, 2),
        generated_at=datetime.utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return VatReportResponse.model_validate(report)


# ─── Export ───────────────────────────────────────────────────────────────────

@router.post("/report/export")
@limiter.limit("10/minute")
async def export_vat_report(
    request: Request,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export POPDV invoices for the given period as CSV (pdv + placeno statuses only)."""
    month_str = f"{year}-{month:02d}"
    invoices = (
        db.query(PdvInvoice)
        .filter(
            PdvInvoice.user_id == current_user.id,
            PdvInvoice.status.in_(POPDV_STATUSES),
            (PdvInvoice.invoice_date.like(f"{month_str}%")) | (PdvInvoice.invoice_date.is_(None)),
        )
        .order_by(PdvInvoice.invoice_date)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    writer.writerow([f"POPDV Izveštaj — {month:02d}/{year}"])
    writer.writerow([])
    writer.writerow(["Dobavljač", "Broj fakture", "Datum", "Osnovica", "Stopa PDV", "PDV iznos", "Ukupno", "Status"])

    total_base_20 = total_vat_20 = total_base_10 = total_vat_10 = 0.0

    for inv in invoices:
        rate_display = f"{int((inv.vat_rate or 0) * 100)}%" if inv.vat_rate else ""
        writer.writerow([
            inv.vendor_name or "",
            inv.invoice_number or "",
            inv.invoice_date or "",
            f"{inv.base_amount:.2f}" if inv.base_amount is not None else "",
            rate_display,
            f"{inv.vat_amount:.2f}" if inv.vat_amount is not None else "",
            f"{inv.total_amount:.2f}" if inv.total_amount is not None else "",
            inv.status,
        ])
        if inv.vat_rate == 0.20:
            total_base_20 += inv.base_amount or 0.0
            total_vat_20 += inv.vat_amount or 0.0
        elif inv.vat_rate == 0.10:
            total_base_10 += inv.base_amount or 0.0
            total_vat_10 += inv.vat_amount or 0.0

    writer.writerow([])
    writer.writerow(["REKAPITULACIJA"])
    writer.writerow(["Stopa 20% — Osnovica", f"{total_base_20:.2f}", "PDV", f"{total_vat_20:.2f}"])
    writer.writerow(["Stopa 10% — Osnovica", f"{total_base_10:.2f}", "PDV", f"{total_vat_10:.2f}"])
    writer.writerow([
        "UKUPNO PDV",
        f"{(total_vat_20 + total_vat_10):.2f}",
        "UKUPNO SA PDV",
        f"{(total_base_20 + total_base_10 + total_vat_20 + total_vat_10):.2f}",
    ])

    filename = f"POPDV_{year}_{month:02d}.csv"
    return Response(
        content=output.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
