"""
LLM Service — sends OCR text to local Ollama instance for structured extraction.
Model: llama3.1:8b (must be pulled before starting — run: ollama pull llama3.1:8b)
This service performs ZERO AI inference itself — it only calls the Ollama HTTP API.
"""

import json
import logging
import os
import re

import ollama

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a precise financial document data extraction engine for Serbian, Bosnian, and Croatian fiscal receipts and invoices.

You receive raw OCR text from a scanned receipt or invoice photo. Extract ALL available data and return ONLY a valid JSON object. No explanation, no markdown, no text outside the JSON.

CRITICAL NUMBER PARSING RULES:
- Serbian format: period = thousand separator, comma = decimal. Example: 1.780,00 -> 1780.00
- Always return numbers as floats, never strings
- If a number is ambiguous, return null — never guess
- UKUPAN IZNOS EXTRACTION RULE — THIS IS THE MOST COMMON ERROR: The line "Ukupan iznos: 379.98" = ukupan_iznos field. ALWAYS use this value. The line "Gotovina: 500.00" = gotovina field. This is cash given by customer. The line "Povracaj: 120.02" or "Kusur: 120.02" = povracaj field. This is change. MATHEMATICAL CHECK: gotovina - ukupan_iznos = povracaj. If you put 120.02 in ukupan_iznos, that fails: 500 - 120.02 ≠ 120.02. Use this math to self-verify before returning JSON.

CRITICAL DATE PARSING:
- Any date format -> YYYY-MM-DD
- "30.03.2026" -> "2026-03-30"
- "3/30/2026" -> "2026-03-30"
- "30. 03. 2026" -> "2026-03-30"
- Full PFR timestamp "30.03.2026 21:32:35" -> store in vreme_transakcije as-is, date part in datum_izdavanja

DOCUMENT TYPE DETECTION:
- "FISKALNI RACUN" or Cyrillic equivalent header -> "gotovinski_racun"
- Contains PIB + formal invoice number + recipient company -> "faktura"
- Contains "PUTNI NALOG" or Cyrillic equivalent -> "putni_nalog"
- Otherwise -> "ostalo"
- Company name extraction rule: after the FISKALNI RACUN / ФИСКАЛНИ РАЧУН header line, the next 1-3 lines of ALL CAPS text = izdavalac.naziv. The following 9-digit number = izdavalac.pib. The line after PIB containing a street name = izdavalac.adresa. Pattern: FISKALNI RACUN -> [COMPANY NAME] -> [PIB NUMBER] -> [ADDRESS] -> [CITY]
- PIB EXTRACTION RULE: PIB is always a standalone 9-digit number on its own line, near the top of the receipt immediately after the company name. Store/branch codes like "1003602-685" contain a dash — these are NOT PIB numbers. PIB never contains a dash. If you see a dash, it is a branch code — skip it and keep looking for the clean 9-digit number.
- ISSUER NAME CLEANUP: Strip trailing OCR artifacts from izdavalac.naziv — remove trailing pipe characters (|, ||), stray letters (o, ee, A), and punctuation noise. Reconstruct abbreviated Serbian legal suffixes: "d.o.o" → "d.o.o.", "ao" or "a.d" → "a.d.", "od" or "o.d" → "o.d." Do not strip words that are part of the actual company name.

CYRILLIC HANDLING:
- Convert Cyrillic field values to Latin for all structured fields
- Keep original Cyrillic spelling for proper nouns (company names)

VAT (PDV) HANDLING — Serbian receipts show multiple rates simultaneously:
- Oznaka "A" = 0% (oslobodeno)
- Oznaka "E" = П-PDV = 10% (prehrambeni proizvodi)
- Oznaka "DJ" or "Dj" = О-PDV = 20% (standardna stopa)
- Cyrillic Ђ and Latin DJ both mean O-PDV = 20% standard rate. Cyrillic Е and Latin E both mean П-PDV = 10% reduced rate. OCR often misreads Ђ as E, B, or 6. Rule: if two VAT rates exist and one is 10% and one is 20%, assign oznaka "E" to the 10% entry and oznaka "Đ" to the 20% entry regardless of what letter the OCR returned.
Extract each rate and amount separately in pdv_breakdown array.

PAYMENT METHOD DETECTION:
- "Gotovina" present with amount -> nacin_placanja = "gotovina"
- "Drugo bezgotovinsko" -> nacin_placanja = "bezgotovinsko"
- "Kartica" -> nacin_placanja = "kartica"
- Both cash and card -> "kombinovano"

Return this exact JSON structure:
{
  "tip_dokumenta": "gotovinski_racun" | "faktura" | "putni_nalog" | "ostalo",
  "broj_dokumenta": "string or null",
  "datum_izdavanja": "YYYY-MM-DD or null",
  "vreme_transakcije": "DD.MM.YYYY HH:MM:SS or null",
  "esir_broj": "string or null",
  "pfr_broj": "string or null",
  "brojac_racuna": "string or null",
  "kasir": "string or null",
  "izdavalac": {
    "naziv": "string or null",
    "pib": "string or null",
    "maticni_broj": "string or null",
    "adresa": "string or null",
    "mesto": "string or null"
  },
  "primalac": {
    "naziv": "string or null",
    "pib": "string or null"
  },
  "stavke": [
    {
      "naziv": "string",
      "cena": number or null,
      "kolicina": number or null,
      "pdv_oznaka": "A" | "E" | "DJ" | null,
      "iznos": number or null
    }
  ],
  "broj_artikala": number or null,
  "ukupan_iznos": number or null,
  "gotovina": number or null,
  "povracaj": number or null,
  "nacin_placanja": "gotovina" | "kartica" | "bezgotovinsko" | "kombinovano" | null,
  "pdv_breakdown": [
    {
      "oznaka": "string",
      "ime": "string",
      "stopa": number,
      "iznos": number
    }
  ],
  "ukupan_pdv": number or null,
  "valuta": "RSD" | "EUR" | "USD" | "BAM" | null,
  "pouzdanost": number between 0.0 and 1.0
}

Rules for "pouzdanost":
- 0.9-1.0: Text clear, all major fields extracted cleanly
- 0.7-0.9: Some fields missing but totals and issuer are clear
- 0.5-0.7: Significant OCR artifacts, key fields inferred
- 0.0-0.5: Text mostly unreadable, data uncertain"""

# Profile-specific instruction appended to the user message
_PROFILE_INSTRUCTIONS = {
    "osnovno": "Focus extraction on: total amount, date, issuer name and PIB only. Return null for all other fields.",
    "pdv": "Focus extraction on: complete PDV breakdown with all rates and amounts, total PDV, issuer, date. This will be used for tax filing.",
    "artikli": "Focus extraction on: complete itemized list with individual prices, quantities, and PDV labels per item.",
    "placanje": "Focus extraction on: payment method, cash amount, change returned, total amount.",
    "potpuno": "",
}


def parse_invoice(raw_ocr_text: str, scan_profile: str = "potpuno") -> dict:
    """
    Send OCR text to Ollama and return parsed invoice data as a dict.

    Args:
        raw_ocr_text: Full OCR output from tesseract.
        scan_profile: Extraction focus — one of: potpuno, osnovno, pdv, artikli, placanje.

    Returns:
        dict with all invoice fields plus 'pouzdanost' confidence score.
    Raises:
        RuntimeError: If Ollama is unreachable or returns an unrecoverable error.
    """
    if not raw_ocr_text or len(raw_ocr_text.strip()) < 10:
        return _empty_result(confidence=0.0, reason="OCR text too short")

    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    profile_instruction = _PROFILE_INSTRUCTIONS.get(scan_profile, "")
    user_message = f"Extract data from this OCR text:\n\n{raw_ocr_text}"
    if profile_instruction:
        user_message += f"\n\nINSTRUCTION: {profile_instruction}"

    try:
        client = ollama.Client(host=ollama_url)

        response = client.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            options={
                "temperature": 0.0,
                "top_p": 0.9,
                "num_predict": 2048,
            },
        )

        response_text = response["message"]["content"].strip()

        json_match = re.search(r"\{[\s\S]*\}", response_text)
        if not json_match:
            raise ValueError(f"No JSON found in LLM response: {response_text[:200]}")

        parsed = json.loads(json_match.group())
        return _validate_and_clean(parsed)

    except ollama.ResponseError as e:
        logger.error("Ollama ResponseError: %s", e)
        raise RuntimeError("LLM service unavailable. Is Ollama running? Run: ollama serve")
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s", e)
        return _empty_result(confidence=0.0, reason="LLM returned malformed JSON")
    except Exception as e:
        logger.error("LLM parsing failed: %s", e)
        raise RuntimeError(str(e))


def _validate_and_clean(data: dict) -> dict:
    """Ensure all expected fields exist and values are correct types."""
    required_fields = [
        "tip_dokumenta", "broj_dokumenta", "datum_izdavanja", "vreme_transakcije",
        "esir_broj", "pfr_broj", "brojac_racuna", "kasir",
        "izdavalac", "primalac", "stavke", "broj_artikala",
        "ukupan_iznos", "gotovina", "povracaj", "nacin_placanja",
        "pdv_breakdown", "ukupan_pdv", "valuta", "pouzdanost",
    ]
    for field in required_fields:
        if field not in data:
            data[field] = None

    if data.get("pouzdanost") is not None:
        data["pouzdanost"] = max(0.0, min(1.0, float(data["pouzdanost"])))
    else:
        data["pouzdanost"] = 0.5

    if not isinstance(data.get("stavke"), list):
        data["stavke"] = []

    if not isinstance(data.get("pdv_breakdown"), list):
        data["pdv_breakdown"] = []

    # Derive broj_artikala from stavke length if not set
    if data.get("broj_artikala") is None and data["stavke"]:
        data["broj_artikala"] = len(data["stavke"])

    return data


def _empty_result(confidence: float, reason: str = "") -> dict:
    """Return a fully-structured empty result when parsing cannot proceed."""
    return {
        "tip_dokumenta": "ostalo",
        "broj_dokumenta": None,
        "datum_izdavanja": None,
        "vreme_transakcije": None,
        "esir_broj": None,
        "pfr_broj": None,
        "brojac_racuna": None,
        "kasir": None,
        "izdavalac": {"naziv": None, "pib": None, "maticni_broj": None, "adresa": None, "mesto": None},
        "primalac": {"naziv": None, "pib": None},
        "stavke": [],
        "broj_artikala": None,
        "ukupan_iznos": None,
        "gotovina": None,
        "povracaj": None,
        "nacin_placanja": None,
        "pdv_breakdown": [],
        "ukupan_pdv": None,
        "valuta": "RSD",
        "pouzdanost": confidence,
        "_parse_note": reason,
    }
