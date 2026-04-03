"""
OCR Service — extracts raw text from invoice images using pytesseract.
Tesseract must be installed system-wide (see README prerequisites).
Language packs required: srp (Serbian), srp_latn (Serbian Latin).
Falls back to 'eng' if Balkan language packs are unavailable.
"""

import logging

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

TESSERACT_LANGS = "srp+srp_latn+eng"
FALLBACK_LANGS = "eng"


def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Preprocessing pipeline to improve OCR accuracy on bad scans:
    1. Convert to grayscale
    2. Increase contrast (factor 2.0)
    3. Sharpen
    """
    img = image.convert("L")
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)
    img = img.filter(ImageFilter.SHARPEN)
    return img


def extract_text(filepath: str) -> dict:
    """
    Run OCR on the image at the given filepath.

    Returns:
        dict with keys:
          - raw_text (str): Full OCR output
          - confidence (float): Average word confidence 0.0-1.0
          - language (str): Language pack used
    Raises:
        RuntimeError: If OCR processing fails entirely.
    """
    try:
        image = Image.open(filepath)
        processed = preprocess_image(image)

        try:
            data = pytesseract.image_to_data(
                processed,
                lang=TESSERACT_LANGS,
                output_type=pytesseract.Output.DICT,
                config="--psm 6",
            )
            lang_used = TESSERACT_LANGS
        except pytesseract.TesseractError:
            logger.warning("Serbian lang pack not found, falling back to English")
            data = pytesseract.image_to_data(
                processed,
                lang=FALLBACK_LANGS,
                output_type=pytesseract.Output.DICT,
                config="--psm 6",
            )
            lang_used = FALLBACK_LANGS

        confidences = [int(c) for c in data["conf"] if int(c) > 0]
        avg_raw = (sum(confidences) / len(confidences)) if confidences else 0.0
        avg_confidence = avg_raw / 100.0

        raw_text = " ".join([word for word in data["text"] if word.strip()])

        return {
            "raw_text": raw_text,
            "confidence": round(avg_confidence, 3),       # 0.0-1.0 — backward compat
            "confidence_score": round(avg_raw, 1),        # 0-100 — stored in DB
            "language": lang_used,
        }

    except Exception as e:
        logger.error("OCR failed for %s: %s", filepath, e)
        raise RuntimeError(f"OCR processing failed: {str(e)}")
