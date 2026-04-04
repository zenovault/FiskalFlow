"""Application configuration loaded from environment variables via pydantic BaseSettings."""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    """All configuration values come from environment variables or .env file."""

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    DATABASE_URL: str = "sqlite:///./data/birokrat.db"

    CORS_ORIGINS: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    POLYGON_RPC_URL: Optional[str] = None
    POLYGON_PRIVATE_KEY: Optional[str] = None
    CONTRACT_ADDRESS: Optional[str] = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:
        """Accept comma-separated origins string."""
        return v

    def get_cors_origins(self) -> List[str]:
        """Return CORS origins as a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def max_upload_bytes(self) -> int:
        """Return max upload size in bytes."""
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
