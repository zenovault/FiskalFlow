"""
ValidDoc — blockchain certificate verification module.

Real on-chain storage via Polygon Amoy testnet (ValidDocRegistry contract).
Falls back to local-only if blockchain is unavailable (status="pending_chain").
The /verify/{cert_hash} endpoint requires NO authentication (employer-facing).
"""

import hashlib
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.certificate import Certificate
from services.auth_service import get_current_user
from services.blockchain_service import blockchain_service
from models.user import User

router = APIRouter(prefix="/api/validoc", tags=["ValidDoc"])


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
    id: Optional[int] = None
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
    # Blockchain fields
    polygonscan_url: Optional[str] = None
    doc_hash: Optional[str] = None
    chain_timestamp: Optional[int] = None
    chain_status: Optional[str] = None  # success | already_registered | pending_chain

    model_config = {"from_attributes": True}


def _build_response(cert: Certificate, base_url: str = "http://localhost:5173") -> CertificateResponse:
    # QR code points to PolygonScan tx if available, otherwise internal verify URL
    internal_url = f"{base_url}/verify/{cert.hash}"
    polygonscan = getattr(cert, 'polygonscan_url', None)
    qr_data = polygonscan if polygonscan else internal_url
    return CertificateResponse(
        id=cert.id,
        token_id=cert.token_id,
        hash=cert.hash,
        verification_url=internal_url,
        qr_data=qr_data,
        tx_hash=cert.tx_hash or ("0x" + cert.hash[:64]),
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
        polygonscan_url=polygonscan,
        doc_hash=getattr(cert, 'doc_hash', None),
        chain_timestamp=getattr(cert, 'chain_timestamp', None),
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

    # Build a deterministic byte payload for blockchain hashing (same data as cert_hash input)
    chain_bytes = cert_data.encode()

    certificate = Certificate(
        token_id=token_id,
        hash=cert_hash,
        tx_hash="0x" + cert_hash[:64],  # fallback; overwritten after blockchain call
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

    # Blockchain registration (non-blocking — failure saves locally with pending_chain)
    bc = blockchain_service.store_document(chain_bytes, cert.tip_dokumenta)
    certificate.doc_hash = bc.get("hash")
    certificate.chain_timestamp = bc.get("chain_timestamp")
    if bc["status"] in ("success", "already_registered"):
        certificate.tx_hash = bc.get("tx_hash") or ("0x" + cert_hash[:64])
        certificate.polygonscan_url = bc.get("polygonscan_url")
    else:
        # pending_chain — mark with local fallback tx_hash so existing code still works
        certificate.tx_hash = "0x" + cert_hash[:64]
        certificate.polygonscan_url = None
    db.commit()
    db.refresh(certificate)

    resp = _build_response(certificate)
    resp.chain_status = bc["status"]
    return resp


@router.get("/verify/{cert_hash}", response_model=CertificateResponse)
def verify_certificate(cert_hash: str, db: Session = Depends(get_db)):
    """Public endpoint — no auth required. Employer scans QR and hits this endpoint."""
    cert = db.query(Certificate).filter(Certificate.hash == cert_hash).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Sertifikat nije pronađen ili je nevažeći")
    return _build_response(cert)


@router.get("/verify-chain/{cert_id}")
def verify_on_chain(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-verify a stored certificate against the live Polygon blockchain."""
    cert = db.query(Certificate).filter(
        Certificate.id == cert_id,
        Certificate.user_id == current_user.id,
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Sertifikat nije pronađen")

    chain_bytes = cert_data_bytes(cert)
    result = blockchain_service.verify_document(chain_bytes)
    return result


def cert_data_bytes(cert: Certificate) -> bytes:
    ime = cert.ime_lica or cert.ime_studenta or ''
    prezime = cert.prezime_lica or cert.prezime_studenta or ''
    raw = ime + prezime + cert.naziv_institucije + cert.broj_diplome + cert.datum_izdavanja
    return raw.encode()


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
