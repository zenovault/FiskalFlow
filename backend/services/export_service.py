"""
Export service — generates CSV downloads from invoice records.
"""

import csv
import io
import logging
from datetime import date
from typing import List

from models.invoice import Invoice

logger = logging.getLogger(__name__)

CSV_HEADERS = [
    "id",
    "tip_dokumenta",
    "broj_dokumenta",
    "datum_izdavanja",
    "vreme_transakcije",
    "izdavalac_naziv",
    "izdavalac_pib",
    "izdavalac_adresa",
    "kasir",
    "esir_broj",
    "broj_artikala",
    "ukupan_iznos",
    "pdv_stopa_e_10",
    "pdv_iznos_e_10",
    "pdv_stopa_dj_20",
    "pdv_iznos_dj_20",
    "ukupan_pdv",
    "gotovina",
    "povracaj",
    "nacin_placanja",
    "valuta",
    "pouzdanost",
    "rucno_provereno",
    "datum_unosa",
]


def _f(val) -> str:
    """Return empty string for None, otherwise the value as-is."""
    return "" if val is None else val


def _n(val) -> str:
    """Return empty string for None numeric values."""
    return "" if val is None else str(val)


def generate_csv(invoices: List[Invoice]) -> str:
    """
    Generate a CSV string from a list of Invoice ORM objects.

    Returns:
        UTF-8-BOM CSV string (Excel compatible) with headers and one row per invoice.
    """
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_HEADERS, extrasaction="ignore")
    writer.writeheader()

    for inv in invoices:
        # Derive ukupan_pdv from breakdown columns
        ukupan_pdv = (inv.pdv_iznos_e or 0) + (inv.pdv_iznos_dj or 0) + (inv.pdv_iznos_a or 0)
        if ukupan_pdv == 0 and inv.vat_amount:
            ukupan_pdv = inv.vat_amount

        writer.writerow({
            "id": inv.id,
            "tip_dokumenta": _f(inv.document_type),
            "broj_dokumenta": _f(inv.invoice_number),
            "datum_izdavanja": _f(inv.issue_date),
            "vreme_transakcije": _f(inv.vreme_transakcije),
            "izdavalac_naziv": _f(inv.issuer_name),
            "izdavalac_pib": _f(inv.issuer_pib),
            "izdavalac_adresa": _f(inv.adresa_izdavaoca),
            "kasir": _f(inv.kasir),
            "esir_broj": _f(inv.esir_broj),
            "broj_artikala": _n(inv.broj_artikala),
            "ukupan_iznos": _n(inv.total_amount),
            "pdv_stopa_e_10": _n(inv.pdv_stopa_e),
            "pdv_iznos_e_10": _n(inv.pdv_iznos_e),
            "pdv_stopa_dj_20": _n(inv.pdv_stopa_dj),
            "pdv_iznos_dj_20": _n(inv.pdv_iznos_dj),
            "ukupan_pdv": _n(ukupan_pdv) if ukupan_pdv else "",
            "gotovina": _n(inv.gotovina),
            "povracaj": _n(inv.povracaj),
            "nacin_placanja": _f(inv.nacin_placanja_detalj),
            "valuta": inv.currency or "RSD",
            "pouzdanost": _n(inv.confidence),
            "rucno_provereno": "1" if inv.manually_verified else "0",
            "datum_unosa": inv.created_at.isoformat() if inv.created_at else "",
        })

    return output.getvalue()


def get_export_filename() -> str:
    """Return a date-stamped CSV filename for content-disposition header."""
    today = date.today().strftime("%Y-%m-%d")
    return f"racuni_export_{today}.csv"
