"""
Auth router — handles user registration, login, and current user retrieval.
All auth routes have strict rate limiting to prevent brute force attacks.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models.user import User
from schemas.user import TokenResponse, UserLogin, UserRegister, UserResponse
from services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/15minutes")
async def register(request: Request, body: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user account.

    Rate limited to 5 requests per 15 minutes per IP.
    Returns a JWT access token on success.
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Email already registered", "code": "EMAIL_EXISTS"},
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name.strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    logger.info("New user registered: %s (id=%d)", user.email, user.id)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/15minutes")
async def login(request: Request, body: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate an existing user and return a JWT token.

    Rate limited to 5 requests per 15 minutes per IP.
    Returns generic error on failure — never reveals which field is wrong.
    """
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Incorrect credentials", "code": "INVALID_CREDENTIALS"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Incorrect credentials", "code": "INVALID_CREDENTIALS"},
        )

    token = create_access_token({"sub": str(user.id)})
    logger.info("User logged in: %s (id=%d)", user.email, user.id)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
@limiter.limit("60/minute")
async def get_me(request: Request, current_user: User = Depends(get_current_user)):
    """
    Return the currently authenticated user's profile.

    Requires a valid Bearer token in the Authorization header.
    """
    return UserResponse.model_validate(current_user)
