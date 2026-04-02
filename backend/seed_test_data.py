"""
Test data seeder for Birokrat-Slayer.
Run once: python seed_test_data.py
Creates 1 test user + 5 invoices + 3 TrustDoc certificates.
"""
import sys, os, json, hashlib
from datetime import datetime
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
from models.user import User
from models.invoice import Invoice
from models.certificate import Certificate
from services.auth_service import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── TEST USER ─────────────────────────────────────────────────────
existing = db.query(User).filter(User.email == "test@birokrat.rs").first()
if not existing:
    user = User(
        email="test@birokrat.rs",
        hashed_password=hash_password("Test1234!"),
        full_name="Jelena Nikolic",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print("OK: Korisnik kreiran: test@birokrat.rs / Test1234!")
else:
    user = existing
    print("OK: Korisnik vec postoji")

# ── TEST INVOICES ──────────────────────────────────────────────────
invoices = [
    {
        "original_filename": "delhaize_mart_2026.jpg",
        "stored_filename": "uuid-001.jpg",
        "document_type": "gotovinski_racun",
        "invoice_number": "8253/8280PP",
        "issue_date": "2026-03-30",
        "issuer_name": "DELHAIZE SERBIA DOO BEOGRAD",
        "issuer_pib": "103482050",
        "total_amount": 379.98,
        "vat_amount": 56.51,
        "currency": "RSD",
        "processing_status": "completed",
        "confidence": 0.87,
        "manually_verified": True,
        "tip_fakture": "ulazna",
        "interni_broj": "TRO-2026-031",
        "raw_ocr_text": "FISKALNI RACUN DELHAIZE SERBIA...",
        "extracted_json": json.dumps({"tip_dokumenta": "gotovinski_racun", "ukupan_iznos": 379.98}),
    },
    {
        "original_filename": "the_saint_marzo.jpg",
        "stored_filename": "uuid-002.jpg",
        "document_type": "gotovinski_racun",
        "invoice_number": "GDZUEM4H-C38FDV00-8280",
        "issue_date": "2026-03-30",
        "issuer_name": "FINEST FOOD - THE SAINT",
        "total_amount": 1780.00,
        "vat_amount": 296.67,
        "currency": "RSD",
        "processing_status": "completed",
        "confidence": 0.74,
        "manually_verified": False,
        "tip_fakture": "ulazna",
        "interni_broj": "REP-2026-004",
        "raw_ocr_text": "FISKALNI RACUN FINEST FOOD...",
        "extracted_json": json.dumps({"tip_dokumenta": "gotovinski_racun", "ukupan_iznos": 1780.00}),
    },
    {
        "original_filename": "faktura_it_usluge_februar.jpg",
        "stored_filename": "uuid-003.jpg",
        "document_type": "faktura",
        "invoice_number": "2026/02/0047",
        "issue_date": "2026-02-15",
        "issuer_name": "SOFTTECH DOO BEOGRAD",
        "issuer_pib": "112345678",
        "total_amount": 96000.00,
        "vat_amount": 16000.00,
        "currency": "RSD",
        "processing_status": "completed",
        "confidence": 0.95,
        "manually_verified": True,
        "tip_fakture": "ulazna",
        "interni_broj": "IT-2026-047",
        "avans_primljen": 48000.00,
        "avans_opravdan": 48000.00,
        "raw_ocr_text": "FAKTURA SOFTTECH DOO...",
        "extracted_json": json.dumps({"tip_dokumenta": "faktura", "ukupan_iznos": 96000.00}),
    },
    {
        "original_filename": "izlazna_faktura_klijent_abc.jpg",
        "stored_filename": "uuid-004.jpg",
        "document_type": "faktura",
        "invoice_number": "IZL-2026/003",
        "issue_date": "2026-03-01",
        "issuer_name": "MOJA FIRMA DOO",
        "issuer_pib": "987654321",
        "total_amount": 240000.00,
        "vat_amount": 40000.00,
        "currency": "RSD",
        "processing_status": "completed",
        "confidence": 0.98,
        "manually_verified": True,
        "tip_fakture": "izlazna",
        "interni_broj": "PROJ-2026-012",
        "avans_primljen": 120000.00,
        "avans_opravdan": 0,
        "raw_ocr_text": "FAKTURA IZL-2026/003...",
        "extracted_json": json.dumps({"tip_dokumenta": "faktura", "ukupan_iznos": 240000.00}),
    },
    {
        "original_filename": "market_jelena_mmm.jpg",
        "stored_filename": "uuid-005.jpg",
        "document_type": "gotovinski_racun",
        "invoice_number": "107441/107450PP",
        "issue_date": "2026-03-30",
        "issuer_name": "MARKET JELENA M&M",
        "total_amount": 119.00,
        "vat_amount": 19.83,
        "currency": "RSD",
        "processing_status": "completed",
        "confidence": 0.81,
        "manually_verified": False,
        "tip_fakture": "ulazna",
        "raw_ocr_text": "FISKALNI RACUN MARKET JELENA...",
        "extracted_json": json.dumps({"tip_dokumenta": "gotovinski_racun", "ukupan_iznos": 119.00}),
    },
]

for inv_data in invoices:
    exists = db.query(Invoice).filter(
        Invoice.invoice_number == inv_data.get("invoice_number"),
        Invoice.user_id == user.id
    ).first()
    if not exists:
        db.add(Invoice(user_id=user.id, **inv_data))
        print("OK: Faktura: " + inv_data['issuer_name'] + " - " + str(inv_data['total_amount']) + " RSD")
    else:
        print("SKIP: Faktura vec postoji: " + inv_data['invoice_number'])
db.commit()

# ── TEST CERTIFICATES ──────────────────────────────────────────────
certs = [
    {
        "ime_lica": "Marko", "prezime_lica": "Markovic",
        "ime_studenta": "Marko", "prezime_studenta": "Markovic",
        "naziv_institucije": "Elektrotehnicki fakultet Beograd",
        "naziv_dokumenta": "Master informatike",
        "naziv_diplome": "Master informatike",
        "tip_dokumenta": "diploma",
        "datum_izdavanja": "2024-06-15",
        "broj_diplome": "ETF-2024-1234",
        "nivo_obrazovanja": "master",
    },
    {
        "ime_lica": "Ana", "prezime_lica": "Jovanovic",
        "ime_studenta": "Ana", "prezime_studenta": "Jovanovic",
        "naziv_institucije": "SOFTTECH DOO BEOGRAD",
        "naziv_dokumenta": "Ugovor o radu - Softverski inzenjer",
        "naziv_diplome": "Ugovor o radu - Softverski inzenjer",
        "tip_dokumenta": "ugovor",
        "datum_izdavanja": "2026-01-15",
        "broj_diplome": "HR-2026-0042",
    },
    {
        "ime_lica": None, "prezime_lica": None,
        "ime_studenta": None, "prezime_studenta": None,
        "naziv_institucije": "Agencija za privredne registre",
        "naziv_dokumenta": "Izvod iz registra - MOJA FIRMA DOO",
        "naziv_diplome": "Izvod iz registra - MOJA FIRMA DOO",
        "tip_dokumenta": "izvod",
        "datum_izdavanja": "2025-11-10",
        "broj_diplome": "APR-BD-123456",
    },
]

for cert_data in certs:
    ime = cert_data.get('ime_lica') or ''
    prezime = cert_data.get('prezime_lica') or ''
    raw = ime + prezime + cert_data['naziv_institucije'] + cert_data['broj_diplome'] + cert_data['datum_izdavanja']
    cert_hash = hashlib.sha256(raw.encode()).hexdigest()
    token_id = str(int(cert_hash[:8], 16))
    if not db.query(Certificate).filter(Certificate.hash == cert_hash).first():
        db.add(Certificate(
            token_id=token_id,
            hash=cert_hash,
            tx_hash="0x" + cert_hash[:64],
            user_id=user.id,
            je_validan=True,
            issued_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
            **cert_data
        ))
        print("OK: Sertifikat: " + cert_data['naziv_dokumenta'])
        print("  URL: http://localhost:5173/verify/" + cert_hash)
    else:
        print("SKIP: Sertifikat vec postoji: " + cert_data['naziv_dokumenta'])
db.commit()
db.close()

print("")
print("DONE: Seeder zavrsen!")
print("Email: test@birokrat.rs")
print("Pass:  Test1234!")
