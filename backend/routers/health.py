"""Health check router."""

import subprocess
import logging
import httpx
from fastapi import APIRouter

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/health", tags=["Health"])
async def health_check():
    """
    Returns system health status including Ollama connectivity and Tesseract availability.
    No authentication required.
    """
    ollama_status = "disconnected"
    tesseract_status = "unavailable"

    # Check Ollama
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                ollama_status = "connected"
    except Exception as e:
        logger.warning(f"Ollama health check failed: {e}")

    # Check Tesseract
    try:
        result = subprocess.run(
            ["tesseract", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            tesseract_status = "available"
    except Exception as e:
        logger.warning(f"Tesseract health check failed: {e}")

    return {
        "status": "ok",
        "ollama": ollama_status,
        "tesseract": tesseract_status,
    }
