from pathlib import Path

from fastapi import APIRouter

from app.core.config import get_settings
from app.db import mongo_available
from app.repositories import documents as docs_repo
from app.schemas import StatusResponse
from app.services.vectordb import get_vector_store

router = APIRouter()


@router.get("/status", response_model=StatusResponse)
def status() -> StatusResponse:
    settings = get_settings()
    docs_dir = Path(settings.documents_dir)
    on_disk = sum(
        1 for f in docs_dir.glob("*") if f.suffix.lower() in {".docx", ".xlsx", ".xlsm", ".pdf"}
    )
    store = get_vector_store()

    mongo_ok, mongo_err = mongo_available()
    indexed = 0
    if mongo_ok:
        try:
            indexed = len(docs_repo.list_documents())
        except Exception:  # noqa: BLE001
            indexed = 0

    return StatusResponse(
        status="ok",
        documents_on_disk=on_disk,
        indexed_documents=indexed,
        total_chunks=store.count(),
        embedding_model=settings.embedding_model,
        llm_model=settings.gemini_model,
        gemini_configured=bool(settings.gemini_api_key),
        vector_db="ChromaDB",
        mongodb_connected=mongo_ok,
        mongodb_error=mongo_err,
    )
