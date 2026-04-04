"""
FastAPI application factory.
Sets up CORS, security middleware, rate limiter, and mounts all routers.
"""

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from database import engine, Base, run_migrations
from middleware.security import security_headers_middleware

# Import models so SQLAlchemy knows about them before create_all
import models  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)
cors_logger = logging.getLogger("cors_debug")

# Create upload directory on startup
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Create all database tables, then apply additive migrations for existing DBs
Base.metadata.create_all(bind=engine)
run_migrations()

# Rate limiter instance shared across routers
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="FiskalFlow API",
    description="Automating the accountant's nightmare — Balkan invoices, receipts, and travel orders parsed in seconds.",
    version="1.0.0",
)

# Attach limiter to app state so slowapi middleware can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.on_event("startup")
async def startup_diagnostic():
    cors_logger.info("[STARTUP] CORS_ORIGINS value: %s", settings.CORS_ORIGINS)
    cors_logger.info("[STARTUP] Parsed origins list: %s", settings.get_cors_origins())

# CORS — must be registered before security middleware so it runs outermost
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
app.middleware("http")(security_headers_middleware)


@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Return a structured JSON body on rate limit exceeded."""
    return JSONResponse(
        status_code=429,
        content={"error": "Too many requests. Try again later.", "code": "RATE_LIMIT_EXCEEDED"},
    )


# Mount routers
from routers.health import router as health_router
from routers.auth import router as auth_router
from routers.invoices import router as invoices_router
from routers.trustdoc import router as trustdoc_router
from routers.search import router as search_router
from routers.audit import router as audit_router
from routers.documents import router as documents_router

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(invoices_router)
app.include_router(trustdoc_router)
app.include_router(search_router)
app.include_router(audit_router)
app.include_router(documents_router)

logger.info("FiskalFlow API started. Environment: %s", settings.ENVIRONMENT)
