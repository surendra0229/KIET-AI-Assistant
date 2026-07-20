from pathlib import Path

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.db import MongoUnavailable
from app.middleware.auth import get_current_user
from app.repositories import analytics as analytics_repo
from app.repositories import chats as chats_repo
from app.repositories import documents as docs_repo
from app.repositories import messages as messages_repo
from app.services.vectordb import get_vector_store

router = APIRouter()


@router.get("/dashboard")
def dashboard(user: dict = Depends(get_current_user)) -> dict:
    settings = get_settings()
    store = get_vector_store()
    owner_id = user["userId"]

    on_disk = sum(
        1
        for f in Path(settings.documents_dir).glob("*")
        if f.suffix.lower() in {".docx", ".xlsx", ".xlsm", ".pdf"}
    )

    mongo_ok = True
    mongo_error: str | None = None
    documents: list[dict] = []
    chats_total = 0
    messages_total = 0
    summary: dict = {"chats7d": 0, "uploads7d": 0, "avgRetrievalMs": 0.0, "avgGenerationMs": 0.0}
    daily: list[dict] = []

    try:
        # Documents are institution-wide (admin dashboard).
        documents = docs_repo.list_documents()
        # Chats/messages/analytics are scoped to the current user.
        chats_total = chats_repo.count_sessions(owner_id=owner_id)
        messages_total = messages_repo.count_messages(owner_id=owner_id)
        summary = analytics_repo.summarize(owner_id=owner_id)
        daily = analytics_repo.daily_query_volume(7, owner_id=owner_id)
    except MongoUnavailable as e:
        mongo_ok = False
        mongo_error = str(e)

    return {
        "documents": {
            "onDisk": on_disk,
            "indexed": len(documents),
            "chunks": store.count(),
        },
        "chats": {
            "total": chats_total,
            "messages": messages_total,
        },
        "config": {
            "embeddingModel": settings.embedding_model,
            "vectorDb": "ChromaDB",
            "llm": settings.gemini_model,
            "geminiConfigured": bool(settings.gemini_api_key),
        },
        "performance": summary,
        "queryVolume": daily,
        "recentUploads": [
            {
                "filename": d.get("filename"),
                "chunks": d.get("chunkCount", 0),
                "uploadedAt": d.get("uploadedAt"),
            }
            for d in documents[:5]
        ],
        "mongo": {"connected": mongo_ok, "error": mongo_error},
    }
