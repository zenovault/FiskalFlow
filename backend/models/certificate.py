"""Certificate ORM model for TrustDoc blockchain diploma verification."""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text

from database import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_id = Column(String(20), unique=True)
    hash = Column(String(64), unique=True, index=True)
    tx_hash = Column(String(66))
    ime_studenta = Column(String(100))
    prezime_studenta = Column(String(100))
    naziv_institucije = Column(String(200))
    naziv_diplome = Column(String(200))
    datum_izdavanja = Column(String(10))
    broj_diplome = Column(String(50))
    nivo_obrazovanja = Column(String(20))
    user_id = Column(Integer, ForeignKey("users.id"))
    je_validan = Column(Boolean, default=True)
    issued_at = Column(String(30))
    tip_dokumenta = Column(String(30), default='diploma')
    naziv_dokumenta = Column(String(200), nullable=True)
    ime_lica = Column(String(100), nullable=True)
    prezime_lica = Column(String(100), nullable=True)
    napomena = Column(Text, nullable=True)
