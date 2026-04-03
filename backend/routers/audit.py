"""
Audit Readiness Score — computes a 0-100 score from invoice data quality issues.
Used by the Dashboard to surface poreska kontrola readiness.
"""

import logging

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import get_db
from models.invoice import Invoice
from models.user import User
from services.auth_service import get_current_user

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/audit-score", tags=["Audit"])

_LABELS = [
    (90, "Odličan", "green"),
    (70, "Dobar", "blue"),
    (50, "Potrebna pažnja", "yellow"),
    (0,  "Kritično", "red"),
]


@router.get("")
@limiter.limit("60/minute")
async def get_audit_score(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compute audit readiness score for the current user's invoice dataset."""
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()

    if not invoices:
        return {"score": 100, "label": "Odličan", "color": "green", "issues": []}

    score = 100
    issues = []

    # Each invoice missing PIB: -3 pts (max -30)
    missing_pib = [i for i in invoices if not i.issuer_pib]
    if missing_pib:
        deduct = min(len(missing_pib) * 3, 30)
        score -= deduct
        issues.append(f"{len(missing_pib)} {'račun nema' if len(missing_pib) == 1 else 'računa nema'} PIB izdavaoca")

    # Each invoice missing document number: -2 pts (max -20)
    missing_doc = [i for i in invoices if not i.invoice_number]
    if missing_doc:
        deduct = min(len(missing_doc) * 2, 20)
        score -= deduct
        issues.append(f"{len(missing_doc)} {'račun nema' if len(missing_doc) == 1 else 'računa nema'} broj dokumenta")

    # Each invoice with status "na čekanju" / pending: -2 pts (max -20)
    pending = [i for i in invoices if i.processing_status in ("pending", "na čekanju")]
    if pending:
        deduct = min(len(pending) * 2, 20)
        score -= deduct
        issues.append(f"{len(pending)} {'račun čeka' if len(pending) == 1 else 'računa čekaju'} obradu")

    # Each invoice with confidence_score < 60: -3 pts (max -15)
    low_conf = [i for i in invoices if i.confidence_score is not None and i.confidence_score < 60]
    if low_conf:
        deduct = min(len(low_conf) * 3, 15)
        score -= deduct
        issues.append(f"{len(low_conf)} {'račun ima' if len(low_conf) == 1 else 'računa ima'} nisku pouzdanost OCR-a")

    score = max(0, score)

    label, color = "Kritično", "red"
    for threshold, lbl, clr in _LABELS:
        if score >= threshold:
            label, color = lbl, clr
            break

    return {"score": score, "label": label, "color": color, "issues": issues}
