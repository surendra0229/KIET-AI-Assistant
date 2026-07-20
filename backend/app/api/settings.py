from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.db import MongoUnavailable
from app.repositories import settings as settings_repo
from app.schemas import SettingsPatch

router = APIRouter()


def _mongo_error() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="MongoDB is not available. Set MONGODB_URI in backend/.env.",
    )


@router.get("/settings")
def read_settings() -> dict:
    s = get_settings()
    persisted: dict = {}
    try:
        persisted = settings_repo.get_settings_doc()
    except MongoUnavailable:
        persisted = {}
    return {
        "runtime": {
            "embeddingModel": s.embedding_model,
            "llmModel": s.gemini_model,
            "chunkSize": s.chunk_size,
            "chunkOverlap": s.chunk_overlap,
            "topK": s.top_k,
            "geminiConfigured": bool(s.gemini_api_key),
            "vectorDb": "ChromaDB",
            "chromaPersistDir": s.chroma_persist_dir,
        },
        "user": persisted,
    }


@router.put("/settings")
def update_settings(patch: SettingsPatch) -> dict:
    try:
        data = patch.model_dump(exclude_none=True)
        # Never persist the raw API key in the settings collection.
        # We flag whether it was provided so the UI can show status.
        if "geminiApiKey" in data:
            key = data.pop("geminiApiKey")
            data["geminiApiKeyConfigured"] = bool(key and key.strip())
        updated = settings_repo.update_settings(data)
    except MongoUnavailable:
        raise _mongo_error()
    return updated
