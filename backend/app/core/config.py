from functools import lru_cache
from pathlib import Path
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from env vars / .env file."""

    app_env: str = "development"

    # Allowed frontend origins
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:3000",

        # Vercel Frontend
        "https://kiet-ai-assistant.vercel.app",
    ]

    # AI stack
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 5

    # Storage
    data_dir: str = "./data"
    documents_dir: str = "./data/documents"
    chroma_persist_dir: str = "./data/chroma"
    chroma_collection: str = "college_docs"

    # MongoDB
    mongodb_uri: str = ""
    mongodb_db: str = "college_ai"

    # Auth
    jwt_secret: str = ""
    jwt_expire_minutes: int = 7200
    jwt_algorithm: str = "HS256"

    # Super admin bootstrap
    super_admin_name: str = "Surendra"
    super_admin_email: str = "surendrachennamalli177@gmail.com"
    super_admin_password: str = "surendra@123"

    # SMTP (placeholders)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    email_from: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.documents_dir, self.chroma_persist_dir):
            Path(p).mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s