"""
Natural language invoice search — sends user query + invoice context to Ollama,
returns matching invoice IDs. Unauthenticated results are impossible: only the
current user's invoices are sent as context.
"""

import json
import logging
import os
import re

import ollama
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import get_db
from models.invoice import Invoice
from models.user import User
from services.auth_service import get_current_user

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/search", tags=["Search"])

SYSTEM_PROMPT = (
    "You are a financial data filter for a Serbian accounting app. "
    "Given invoices as JSON and a query in Serbian or English, return ONLY a JSON array "
    "of matching invoice IDs. No explanation. No markdown. Example: [1, 4, 7] or []"
)


class SearchQuery(BaseModel):
    query: str


@router.post("")
@limiter.limit("10/minute")
async def natural_language_search(
    request: Request,
    body: SearchQuery,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Filter user's invoices via LLM natural language query. Returns matching IDs."""
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()

    invoices_json = json.dumps(
        [
            {
                "id": i.id,
                "issuer": i.issuer_name,
                "amount": i.total_amount,
                "vat": i.vat_amount,
                "date": i.issue_date,
                "status": i.processing_status,
                "invoice_type": i.tip_fakture or "ulazna",
            }
            for i in invoices
        ],
        ensure_ascii=False,
    )

    user_message = (
        f"Invoices: {invoices_json}\n"
        f"Query: {body.query}\n"
        "Return matching invoice IDs as JSON array:"
    )

    try:
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        client = ollama.Client(host=ollama_url)

        response = client.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            options={"temperature": 0.0, "num_predict": 512},
        )

        text = response["message"]["content"].strip()
        # Strip markdown code fences if present
        text = re.sub(r"```(?:json)?", "", text).strip()

        ids = json.loads(text)
        if not isinstance(ids, list):
            ids = []
        ids = [int(i) for i in ids if str(i).lstrip("-").isdigit()]

        return {"ids": ids}

    except json.JSONDecodeError:
        logger.warning("NL search: LLM returned unparseable JSON for query: %s", body.query)
        return {"ids": [], "error": "parse_failed"}
    except Exception as e:
        logger.error("NL search failed: %s", e)
        return {"ids": [], "error": "search_failed"}
