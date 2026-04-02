"""
Unified Documents router — single upload endpoint for any document type.
Detects whether uploaded file is a faktura, racun, or putni_nalog,
then extracts the relevant fields via OCR + Ollama.
All endpoints require JWT authentication.
"""

import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path

import ollama
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.document import Document
from models.pdv_invoice import PdvInvoice
from models.user import User
from schemas.document import DocumentResponse
from services.auth_service import get_current_user
from services.ocr_service import extract_text
from utils.validators import validate_and_read_upload

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/documents", tags=["Documents"])

UNIFIED_PROMPT = """Analiziraj ovaj dokument i odredi tip:
- ako je FAKTURA (račun između firmi, sadrži PIB, osnovi iznos, PDV stopu) izvuci: vendor_name, invoice_number, invoice_date, base_amount, vat_rate, vat_amount, total_amount
- ako je RACUN (maloprodajni fiskalni račun, kasirski isečak) izvuci: store_name, receipt_date, total_amount, vat_amount, items (lista opisa)
- ako je PUTNI NALOG (nalog za službeno putovanje, sadrži destinaciju i zaposlenog) izvuci: employee_name, destination, date_from, date_to, purpose

Odgovori SAMO u JSON formatu bez ikakvog teksta pre ili posle JSON-a.
JSON mora imati:
- polje "document_type" sa vrednoscu: "faktura", "racun" ili "putni_nalog"
- polje "data" sa izvucenim podacima

Pravila za iznose: ukloni separatore hiljada, zarez pretvori u tacku, vrati kao broj.
Pravila za datume: pretvori u format YYYY-MM-DD.
Pravila za vat_rate: mora biti 0.10 ili 0.20 (ne 10 ili 20).
Ako polje nije prisutno u dokumentu, koristi null."""


def _call_ollama(raw_text: str) -> dict:
    """Send OCR text to Ollama with unified classification prompt."""
    if not raw_text or len(raw_text.strip()) < 10:
        return {"document_type": "nepoznato", "data": {}}

    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    try:
        client = ollama.Client(host=ollama_url)
        response = client.chat(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": f"{UNIFIED_PROMPT}\n\nTekst dokumenta:\n\n{raw_text}",
                }
            ],
            options={"temperature": 0.0, "top_p": 0.9, "num_predict": 1024},
        )
        text = response["message"]["content"].strip()
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise ValueError("No JSON in LLM response")
        return json.loads(match.group())
    except ollama.ResponseError as e:
        logger.error("Ollama error: %s", e)
        raise RuntimeError("LLM servis nije dostupan. Da li je Ollama pokrenut?")
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s", e)
        return {"document_type": "nepoznato", "data": {}}
    except Exception as e:
        logger.error("Document LLM extraction failed: %s", e)
        raise RuntimeError(str(e))


def _map_fields(doc: Document, doc_type: str, data: dict) -> None:
    """Map extracted LLM data fields onto the Document model instance."""
    doc.document_type = doc_type

    if doc_type == "faktura":
        doc.vendor_name = data.get("vendor_name")
        doc.invoice_number = data.get("invoice_number")
        doc.invoice_date = data.get("invoice_date")
        doc.total_amount = _to_float(data.get("total_amount"))
        doc.vat_amount = _to_float(data.get("vat_amount"))
        doc.base_amount = _to_float(data.get("base_amount"))
        vr = data.get("vat_rate")
        if vr in (10, 10.0):
            vr = 0.10
        elif vr in (20, 20.0):
            vr = 0.20
        doc.vat_rate = vr if vr in (0.10, 0.20) else None

    elif doc_type == "racun":
        doc.store_name = data.get("store_name")
        doc.receipt_date = data.get("receipt_date")
        doc.total_amount = _to_float(data.get("total_amount"))
        doc.vat_amount = _to_float(data.get("vat_amount"))

    elif doc_type == "putni_nalog":
        doc.employee_name = data.get("employee_name")
        doc.destination = data.get("destination")
        doc.date_from = data.get("date_from")
        doc.date_to = data.get("date_to")
        doc.purpose = data.get("purpose")


def _to_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# ─── Upload ──────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentResponse, status_code=201)
@limiter.limit("20/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Universal document upload endpoint.
    Accepts images (JPG/PNG/WEBP/BMP/TIFF).
    Runs OCR, then uses Ollama to classify and extract fields.
    Returns document_type and all parsed fields.
    """
    content, safe_name = await validate_and_read_upload(file)

    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / safe_name
    file_path.write_bytes(content)

    doc = Document(
        user_id=current_user.id,
        filename=Path(file.filename or "upload").name,
        stored_filename=safe_name,
        status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        ocr_result = extract_text(str(file_path))
        raw_text = ocr_result["raw_text"]
        doc.raw_ocr_text = raw_text

        result = _call_ollama(raw_text)
        doc.extracted_json = json.dumps(result, ensure_ascii=False)

        doc_type = result.get("document_type", "nepoznato")
        data = result.get("data", {})
        _map_fields(doc, doc_type, data)

        doc.status = "completed"
        db.commit()
        db.refresh(doc)
        logger.info(
            "Document %d classified as '%s' for user %d",
            doc.id, doc_type, current_user.id,
        )

        # If it's a faktura, also create a PdvInvoice entry so it appears in PDV Asistent
        if doc_type == "faktura":
            pdv_inv = PdvInvoice(
                user_id=current_user.id,
                filename=doc.filename,
                stored_filename=doc.stored_filename,
                status="primljen",
                vendor_name=doc.vendor_name,
                invoice_number=doc.invoice_number,
                invoice_date=doc.invoice_date,
                base_amount=doc.base_amount,
                vat_rate=doc.vat_rate,
                vat_amount=doc.vat_amount,
                total_amount=doc.total_amount,
            )
            db.add(pdv_inv)
            db.commit()
            logger.info(
                "PdvInvoice created (id=%d) from Document %d for user %d",
                pdv_inv.id, doc.id, current_user.id,
            )

    except Exception as e:
        logger.error("Document processing failed for doc %d: %s", doc.id, e)
        doc.status = "error"
        doc.error_message = str(e)
        db.commit()
        db.refresh(doc)
        raise HTTPException(
            status_code=422,
            detail={"error": "Obrada dokumenta nije uspela", "code": "PROCESSING_FAILED", "detail": str(e)},
        )

    return DocumentResponse.model_validate(doc)


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[DocumentResponse])
@limiter.limit("60/minute")
async def list_documents(
    request: Request,
    document_type: str | None = Query(None, description="Filter by type: faktura, racun, putni_nalog"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents for the authenticated user, optionally filtered by type."""
    query = db.query(Document).filter(Document.user_id == current_user.id)
    if document_type:
        query = query.filter(Document.document_type == document_type)
    docs = query.order_by(Document.upload_date.desc()).all()
    return [DocumentResponse.model_validate(d) for d in docs]
