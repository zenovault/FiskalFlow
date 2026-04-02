"""
Invoice router — file upload, listing, retrieval, editing, deletion, export, stats, and image serving.
All endpoints require authentication. Users only see their own invoices.
"""

import json
import logging
import math
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import FileResponse, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.invoice import Invoice
from models.user import User
from schemas.invoice import InvoiceResponse, InvoiceStats, InvoiceUpdate, PaginatedInvoices
from services.auth_service import get_current_user
from services.export_service import generate_csv, get_export_filename
from services.ocr_service import extract_text
from services.llm_service import parse_invoice
from utils.validators import validate_and_read_upload, sanitize_search_query

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


def _get_invoice_or_404(invoice_id: int, user_id: int, db: Session) -> Invoice:
    """Retrieve an invoice belonging to the given user, or raise 404."""
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.user_id == user_id)
        .first()
    )
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail={"error": "Invoice not found", "code": "NOT_FOUND"},
        )
    return invoice


def _map_parsed_to_invoice(invoice: Invoice, parsed: dict, ocr_confidence: float) -> None:
    """Map all LLM-parsed fields onto the Invoice ORM object in place."""
    izdavalac = parsed.get("izdavalac") or {}

    invoice.confidence = parsed.get("pouzdanost") or ocr_confidence
    invoice.document_type = parsed.get("tip_dokumenta")
    invoice.invoice_number = parsed.get("broj_dokumenta")
    invoice.issue_date = parsed.get("datum_izdavanja")
    invoice.issuer_name = izdavalac.get("naziv")
    invoice.issuer_pib = izdavalac.get("pib")
    invoice.total_amount = parsed.get("ukupan_iznos")
    invoice.currency = parsed.get("valuta") or "RSD"

    # Sum vat_amount from pdv_breakdown if available, else ukupan_pdv
    breakdown = parsed.get("pdv_breakdown") or []
    if breakdown:
        invoice.vat_amount = sum(b.get("iznos") or 0 for b in breakdown if isinstance(b, dict))
    else:
        invoice.vat_amount = parsed.get("ukupan_pdv")

    # Patch 1 fields
    invoice.esir_broj = parsed.get("esir_broj")
    invoice.pfr_broj = parsed.get("pfr_broj")
    invoice.brojac_racuna = parsed.get("brojac_racuna")
    invoice.kasir = parsed.get("kasir")
    invoice.adresa_izdavaoca = izdavalac.get("adresa")
    invoice.vreme_transakcije = parsed.get("vreme_transakcije")
    invoice.gotovina = parsed.get("gotovina")
    invoice.povracaj = parsed.get("povracaj")
    invoice.nacin_placanja_detalj = parsed.get("nacin_placanja")
    invoice.broj_artikala = parsed.get("broj_artikala")

    # PDV breakdown stored in individual columns for easy querying
    for item in breakdown:
        if not isinstance(item, dict):
            continue
        oznaka = (item.get("oznaka") or "").upper()
        stopa = item.get("stopa")
        iznos = item.get("iznos")
        if oznaka == "E":
            invoice.pdv_stopa_e = stopa
            invoice.pdv_iznos_e = iznos
        elif oznaka in ("DJ", "Đ", "DŽ"):
            invoice.pdv_stopa_dj = stopa
            invoice.pdv_iznos_dj = iznos
        elif oznaka == "A":
            invoice.pdv_stopa_a = stopa
            invoice.pdv_iznos_a = iznos


@router.post("/upload", response_model=InvoiceResponse, status_code=201)
@limiter.limit("20/minute")
async def upload_invoice(
    request: Request,
    file: UploadFile = File(...),
    scan_profile: str = Form("potpuno"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload an invoice image for OCR and AI extraction.

    Accepts: JPG, PNG, WEBP, BMP, TIFF — max 10MB.
    scan_profile: potpuno | osnovno | pdv | artikli | placanje
    Returns the fully processed invoice object with all extracted fields.
    """
    content, safe_name = await validate_and_read_upload(file)

    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / safe_name
    file_path.write_bytes(content)

    invoice = Invoice(
        user_id=current_user.id,
        original_filename=Path(file.filename or "upload").name,
        stored_filename=safe_name,
        processing_status="processing",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    try:
        ocr_result = extract_text(str(file_path))
        raw_text = ocr_result["raw_text"]
        ocr_confidence = ocr_result["confidence"]

        parsed = parse_invoice(raw_text, scan_profile=scan_profile)

        invoice.raw_ocr_text = raw_text
        invoice.extracted_json = json.dumps(parsed, ensure_ascii=False)
        invoice.processing_status = "completed"
        invoice.updated_at = datetime.utcnow()
        _map_parsed_to_invoice(invoice, parsed, ocr_confidence)

        db.commit()
        db.refresh(invoice)
        logger.info("Invoice %d processed (profile=%s) for user %d", invoice.id, scan_profile, current_user.id)

    except Exception as e:
        logger.error("Processing failed for invoice %d: %s", invoice.id, e)
        invoice.processing_status = "failed"
        invoice.error_message = str(e)
        invoice.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(invoice)
        raise HTTPException(
            status_code=422,
            detail={"error": "Invoice processing failed", "code": "PROCESSING_FAILED", "detail": str(e)},
        )

    return InvoiceResponse.model_validate(invoice)


@router.get("/export/csv")
@limiter.limit("10/minute")
async def export_csv(
    request: Request,
    from_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Export invoices as a CSV file download.

    Optional filters: from_date, to_date (YYYY-MM-DD).
    Returns file with Content-Disposition: attachment.
    """
    query = db.query(Invoice).filter(Invoice.user_id == current_user.id)
    if from_date:
        query = query.filter(Invoice.issue_date >= from_date)
    if to_date:
        query = query.filter(Invoice.issue_date <= to_date)

    invoices = query.order_by(Invoice.created_at.desc()).all()
    csv_content = generate_csv(invoices)
    filename = get_export_filename()

    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/stats", response_model=InvoiceStats)
@limiter.limit("60/minute")
async def get_stats(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return aggregated statistics for the authenticated user's invoices.

    Includes monthly totals, pending verification count, top issuer, and average confidence.
    """
    all_invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()

    now = datetime.utcnow()
    month_invoices = [
        inv for inv in all_invoices
        if inv.created_at and inv.created_at.month == now.month and inv.created_at.year == now.year
    ]

    total_amount_month = sum(inv.total_amount or 0 for inv in month_invoices)
    total_pdv_month = sum(inv.vat_amount or 0 for inv in month_invoices)
    pending = sum(1 for inv in all_invoices if not inv.manually_verified and inv.processing_status == "completed")

    issuers = [inv.issuer_name for inv in all_invoices if inv.issuer_name]
    top_issuer, top_issuer_count = None, 0
    if issuers:
        top_issuer, top_issuer_count = Counter(issuers).most_common(1)[0]

    confidences = [inv.confidence for inv in all_invoices if inv.confidence is not None]
    avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.0

    return InvoiceStats(
        total_count=len(all_invoices),
        total_amount_month=round(total_amount_month, 2),
        total_pdv_month=round(total_pdv_month, 2),
        pending_verification=pending,
        top_issuer=top_issuer,
        top_issuer_count=top_issuer_count,
        avg_confidence=avg_confidence,
    )


@router.get("", response_model=PaginatedInvoices)
@limiter.limit("60/minute")
async def list_invoices(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List invoices for the authenticated user with pagination and optional filters.

    Filters: status, document_type, search (issuer name or invoice number).
    Returns paginated result set.
    """
    query = db.query(Invoice).filter(Invoice.user_id == current_user.id)

    if status:
        query = query.filter(Invoice.processing_status == status)
    if document_type:
        query = query.filter(Invoice.document_type == document_type)
    if search:
        clean_search = sanitize_search_query(search)
        query = query.filter(
            (Invoice.issuer_name.ilike(f"%{clean_search}%"))
            | (Invoice.invoice_number.ilike(f"%{clean_search}%"))
        )

    total = query.count()
    invoices = (
        query.order_by(Invoice.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return PaginatedInvoices(
        items=[InvoiceResponse.model_validate(inv) for inv in invoices],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/report")
@limiter.limit("30/minute")
async def get_invoice_report(
    request: Request,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    invoice_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    issuer: Optional[str] = Query(None),
    vat_rate: Optional[str] = Query(None),
    amount_from: Optional[float] = Query(None),
    amount_to: Optional[float] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Financial report: totals split by ulazna/izlazna, avans summary, remaining for collection."""
    query = db.query(Invoice).filter(Invoice.user_id == current_user.id)
    if from_date:
        query = query.filter(Invoice.issue_date >= from_date)
    if to_date:
        query = query.filter(Invoice.issue_date <= to_date)
    if invoice_type:
        query = query.filter(Invoice.tip_fakture == invoice_type)
    if status:
        query = query.filter(Invoice.processing_status == status)
    if issuer:
        query = query.filter(Invoice.issuer_name.ilike(f"%{issuer}%"))
    if vat_rate == "10":
        query = query.filter(Invoice.pdv_iznos_e.isnot(None))
    elif vat_rate == "20":
        query = query.filter(Invoice.pdv_iznos_dj.isnot(None))
    if amount_from is not None:
        query = query.filter(Invoice.total_amount >= amount_from)
    if amount_to is not None:
        query = query.filter(Invoice.total_amount <= amount_to)

    invoices = query.all()
    ulazne = [i for i in invoices if (i.tip_fakture or "ulazna") == "ulazna"]
    izlazne = [i for i in invoices if i.tip_fakture == "izlazna"]

    def _sum(lst, field):
        return round(sum(getattr(i, field) or 0 for i in lst), 2)

    avansi_u_toku = [
        {
            "id": i.id,
            "izdavalac": i.issuer_name,
            "interni_broj": i.interni_broj,
            "avans_primljen": i.avans_primljen,
            "avans_opravdan": i.avans_opravdan or 0,
            "razlika": round((i.avans_primljen or 0) - (i.avans_opravdan or 0), 2),
            "datum": i.issue_date,
        }
        for i in invoices
        if (i.avans_primljen or 0) > (i.avans_opravdan or 0)
    ]

    return {
        "ulazne": {
            "broj": len(ulazne),
            "ukupan_iznos": _sum(ulazne, "total_amount"),
            "ukupan_pdv": _sum(ulazne, "vat_amount"),
            "avans_primljen": _sum(ulazne, "avans_primljen"),
            "avans_opravdan": _sum(ulazne, "avans_opravdan"),
            "preostalo_za_naplatu": round(
                sum((i.total_amount or 0) - (i.avans_primljen or 0) for i in ulazne), 2
            ),
        },
        "izlazne": {
            "broj": len(izlazne),
            "ukupan_iznos": _sum(izlazne, "total_amount"),
            "ukupan_pdv": _sum(izlazne, "vat_amount"),
            "avans_primljen": _sum(izlazne, "avans_primljen"),
            "avans_opravdan": _sum(izlazne, "avans_opravdan"),
            "preostalo_za_naplatu": round(
                sum((i.total_amount or 0) - (i.avans_primljen or 0) for i in izlazne), 2
            ),
        },
        "avansi_u_toku": avansi_u_toku,
        "ukupno": {
            "broj_faktura": len(invoices),
            "ukupan_iznos": _sum(invoices, "total_amount"),
            "ukupan_pdv": _sum(invoices, "vat_amount"),
        },
    }


@router.get("/{invoice_id}/image")
@limiter.limit("60/minute")
async def get_invoice_image(
    request: Request,
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Serve the original uploaded image for an invoice.

    Validates that the invoice belongs to the authenticated user before serving.
    """
    invoice = _get_invoice_or_404(invoice_id, current_user.id, db)
    file_path = Path(settings.UPLOAD_DIR) / invoice.stored_filename

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": "Image file not found on disk", "code": "FILE_NOT_FOUND"},
        )

    return FileResponse(str(file_path), filename=invoice.original_filename)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
@limiter.limit("60/minute")
async def get_invoice(
    request: Request,
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve a single invoice by ID including raw OCR text and extracted JSON.

    Returns 404 if invoice does not exist or belongs to a different user.
    """
    invoice = _get_invoice_or_404(invoice_id, current_user.id, db)
    return InvoiceResponse.model_validate(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
@limiter.limit("30/minute")
async def update_invoice(
    request: Request,
    invoice_id: int,
    body: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Partially update invoice fields — used for human correction of AI extraction errors.

    Only fields included in the request body are updated.
    """
    invoice = _get_invoice_or_404(invoice_id, current_user.id, db)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(invoice, field, value)
    invoice.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.delete("/{invoice_id}")
@limiter.limit("30/minute")
async def delete_invoice(
    request: Request,
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete an invoice record and its stored image file from disk.

    Returns 404 if invoice does not exist or belongs to a different user.
    """
    invoice = _get_invoice_or_404(invoice_id, current_user.id, db)

    file_path = Path(settings.UPLOAD_DIR) / invoice.stored_filename
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError as e:
            logger.error("Failed to delete file %s: %s", file_path, e)

    db.delete(invoice)
    db.commit()
    logger.info("Invoice %d deleted by user %d", invoice_id, current_user.id)

    return {"message": "Deleted"}
