"""File type, size, and payload validators for invoice uploads."""

import logging
import os
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from config import settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}

# imghdr return values mapped to allowed MIME types
ALLOWED_IMGHDR_TYPES = {"jpeg", "png", "webp", "bmp", "tiff", "rgb"}

# Magic bytes signatures for supported image types
_MAGIC_SIGNATURES = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG": "png",
    b"RIFF": "webp",   # RIFF....WEBP — check more bytes below
    b"BM": "bmp",
    b"II*\x00": "tiff",
    b"MM\x00*": "tiff",
}


def _detect_image_type(header: bytes) -> str:
    """Detect image type from first 12 bytes using magic signatures."""
    if header[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if header[:4] == b"\x89PNG":
        return "png"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "webp"
    if header[:2] == b"BM":
        return "bmp"
    if header[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    return "unknown"


async def validate_and_read_upload(file: UploadFile) -> tuple[bytes, str]:
    """
    Validate an uploaded file for extension, size, and actual MIME type.

    Returns:
        (content bytes, safe UUID-based filename)
    Raises:
        HTTPException 400 if extension or MIME type is not allowed
        HTTPException 413 if file exceeds size limit
    """
    # Check 1: Extension
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={"error": f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}", "code": "INVALID_EXTENSION"},
        )

    # Check 2: Read content up to max+1 to detect oversize
    max_bytes = settings.max_upload_bytes
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail={"error": f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE_MB}MB", "code": "FILE_TOO_LARGE"},
        )

    # Check 3: Actual MIME from magic bytes
    detected = _detect_image_type(content[:12])
    if detected == "unknown":
        raise HTTPException(
            status_code=400,
            detail={"error": "File content does not match a supported image type", "code": "INVALID_MIME"},
        )

    # Check 4: Safe UUID-based filename (never use user-supplied name on disk)
    safe_name = f"{uuid.uuid4()}{suffix}"

    return content, safe_name


def sanitize_search_query(q: str) -> str:
    """Strip HTML tags and limit search query to 100 characters."""
    clean = re.sub(r"<[^>]+>", "", q)
    return clean[:100].strip()
