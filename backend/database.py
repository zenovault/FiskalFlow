"""SQLAlchemy engine, session factory, and declarative base setup."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

# Ensure the data directory exists before SQLite tries to create the file
_db_path = settings.DATABASE_URL.replace("sqlite:///", "")
_db_dir = os.path.dirname(_db_path)
if _db_dir:
    os.makedirs(_db_dir, exist_ok=True)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite with FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that yields a database session and ensures it is closed after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# New columns added in Patch 1 — SQLite does not support IF NOT EXISTS on ADD COLUMN,
# so we attempt each ALTER and silently ignore the "duplicate column" error.
_NEW_COLUMNS = [
    ("esir_broj", "TEXT"),
    ("pfr_broj", "TEXT"),
    ("brojac_racuna", "TEXT"),
    ("kasir", "TEXT"),
    ("adresa_izdavaoca", "TEXT"),
    ("vreme_transakcije", "TEXT"),
    ("gotovina", "REAL"),
    ("povracaj", "REAL"),
    ("nacin_placanja_detalj", "TEXT"),
    ("pdv_stopa_e", "REAL"),
    ("pdv_iznos_e", "REAL"),
    ("pdv_stopa_dj", "REAL"),
    ("pdv_iznos_dj", "REAL"),
    ("pdv_stopa_a", "REAL"),
    ("pdv_iznos_a", "REAL"),
    ("broj_artikala", "INTEGER"),
    # Patch 3 — accounting fields
    ("interni_broj", "TEXT"),
    # Patch 4 — pytesseract confidence score (0-100)
    ("confidence_score", "REAL"),
    ("tip_fakture", 'TEXT DEFAULT "ulazna"'),
    ("avans_primljen", "REAL"),
    ("avans_opravdan", "REAL"),
    ("avans_datum_primanja", "TEXT"),
    ("avans_datum_opravdanja", "TEXT"),
]


_CERT_NEW_COLUMNS = [
    # Patch 5 — ValidDoc real blockchain columns
    ("tx_hash", "VARCHAR"),
    ("polygonscan_url", "VARCHAR"),
    ("doc_hash", "VARCHAR"),
    ("chain_timestamp", "INTEGER"),
]


def run_migrations():
    """Apply additive schema migrations for existing databases."""
    import sqlalchemy as _sa
    with engine.connect() as conn:
        for col_name, col_type in _NEW_COLUMNS:
            try:
                conn.execute(_sa.text(f"ALTER TABLE invoices ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                conn.rollback()
        for col_name, col_type in _CERT_NEW_COLUMNS:
            try:
                conn.execute(_sa.text(f"ALTER TABLE certificates ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                conn.rollback()
