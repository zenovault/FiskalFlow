"""
TrustDoc — blockchain certificate verification module.

Demo architecture: simulates on-chain storage via local SQLite.
Hash, token_id, and tx_hash are real SHA-256/hex values — only storage is local.
The /verify/{cert_hash} endpoint requires NO authentication (employer-facing).
"""

import hashlib
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.certificate import Certificate
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(prefix="/api/trustdoc", tags=["TrustDoc"])


class CertificateCreate(BaseModel):
    ime_studenta: Optional[str] = None
    prezime_studenta: Optional[str] = None
    naziv_institucije: str
    naziv_diplome: Optional[str] = None
    naziv_dokumenta: Optional[str] = None
    datum_izdavanja: str
    broj_diplome: str
    nivo_obrazovanja: Optional[str] = None
    tip_dokumenta: str = 'diploma'
    ime_lica: Optional[str] = None
    prezime_lica: Optional[str] = None
    napomena: Optional[str] = None


class CertificateResponse(BaseModel):
    token_id: str
    hash: str
    verification_url: str
    qr_data: str
    tx_hash: str
    issued_at: str
    ime_studenta: Optional[str] = None
    prezime_studenta: Optional[str] = None
    naziv_institucije: str
    naziv_diplome: Optional[str] = None
    naziv_dokumenta: Optional[str] = None
    datum_izdavanja: str
    nivo_obrazovanja: Optional[str] = None
    broj_diplome: str
    je_validan: bool
    tip_dokumenta: Optional[str] = 'diploma'
    ime_lica: Optional[str] = None
    prezime_lica: Optional[str] = None
    napomena: Optional[str] = None

    model_config = {"from_attributes": True}


def _build_response(cert: Certificate, base_url: str = "http://localhost:5173") -> CertificateResponse:
    url = f"{base_url}/verify/{cert.hash}"
    return CertificateResponse(
        token_id=cert.token_id,
        hash=cert.hash,
        verification_url=url,
        qr_data=url,
        tx_hash=cert.tx_hash,
        issued_at=cert.issued_at,
        ime_studenta=cert.ime_studenta,
        prezime_studenta=cert.prezime_studenta,
        naziv_institucije=cert.naziv_institucije,
        naziv_diplome=cert.naziv_diplome,
        naziv_dokumenta=getattr(cert, 'naziv_dokumenta', None),
        datum_izdavanja=cert.datum_izdavanja,
        nivo_obrazovanja=cert.nivo_obrazovanja,
        broj_diplome=cert.broj_diplome,
        je_validan=cert.je_validan,
        tip_dokumenta=getattr(cert, 'tip_dokumenta', 'diploma'),
        ime_lica=getattr(cert, 'ime_lica', None),
        prezime_lica=getattr(cert, 'prezime_lica', None),
        napomena=getattr(cert, 'napomena', None),
    )


@router.post("/mint", response_model=CertificateResponse, status_code=201)
def mint_certificate(
    cert: CertificateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Issue a new document certificate and register it on the (simulated) blockchain."""
    ime = cert.ime_lica or cert.ime_studenta or ''
    prezime = cert.prezime_lica or cert.prezime_studenta or ''
    cert_data = f"{ime}{prezime}{cert.naziv_institucije}{cert.broj_diplome}{cert.datum_izdavanja}"
    cert_hash = hashlib.sha256(cert_data.encode()).hexdigest()

    existing = db.query(Certificate).filter(Certificate.hash == cert_hash).first()
    if existing:
        return _build_response(existing)

    token_id = str(int(cert_hash[:8], 16))
    tx_hash = "0x" + cert_hash[:64]

    certificate = Certificate(
        token_id=token_id,
        hash=cert_hash,
        tx_hash=tx_hash,
        ime_studenta=cert.ime_studenta or cert.ime_lica,
        prezime_studenta=cert.prezime_studenta or cert.prezime_lica,
        naziv_institucije=cert.naziv_institucije,
        naziv_diplome=cert.naziv_diplome or cert.naziv_dokumenta,
        datum_izdavanja=cert.datum_izdavanja,
        broj_diplome=cert.broj_diplome,
        nivo_obrazovanja=cert.nivo_obrazovanja,
        user_id=current_user.id,
        je_validan=True,
        issued_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
        tip_dokumenta=cert.tip_dokumenta,
        naziv_dokumenta=cert.naziv_dokumenta or cert.naziv_diplome,
        ime_lica=cert.ime_lica or cert.ime_studenta,
        prezime_lica=cert.prezime_lica or cert.prezime_studenta,
        napomena=cert.napomena,
    )
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    return _build_response(certificate)


@router.get("/verify/{cert_hash}", response_model=CertificateResponse)
def verify_certificate(cert_hash: str, db: Session = Depends(get_db)):
    """Public endpoint — no auth required. Employer scans QR and hits this endpoint."""
    cert = db.query(Certificate).filter(Certificate.hash == cert_hash).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Sertifikat nije pronađen ili je nevažeći")
    return _build_response(cert)


@router.get("/list", response_model=list[CertificateResponse])
def list_certificates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all certificates issued by the authenticated user."""
    certs = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id)
        .order_by(Certificate.id.desc())
        .all()
    )
    return [_build_response(c) for c in certs]


@router.post("/revoke/{cert_hash}")
def revoke_certificate(
    cert_hash: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a certificate — sets je_validan=False."""
    cert = db.query(Certificate).filter(
        Certificate.hash == cert_hash,
        Certificate.user_id == current_user.id,
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Sertifikat nije pronađen")
    cert.je_validan = False
    db.commit()
    return {"message": "Sertifikat je poništen"}
