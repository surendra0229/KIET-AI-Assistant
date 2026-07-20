from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db import MongoUnavailable
from app.repositories import analytics as analytics_repo
from app.repositories import documents as docs_repo
from app.schemas import (
    DocumentInfo,
    DocumentsResponse,
    IndexResponse,
    UploadResponse,
    UploadResult,
)
from app.services.rag import ingest_document, reindex_all
from app.services.vectordb import get_vector_store

router = APIRouter()
log = get_logger(__name__)

ALLOWED_EXT = {".docx", ".xlsx", ".xlsm", ".pdf", ".txt"}


def _mongo_error() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="MongoDB is not available. Set MONGODB_URI in backend/.env.",
    )


@router.post("/upload", response_model=UploadResponse)
async def upload(files: list[UploadFile] = File(...)) -> UploadResponse:
    settings = get_settings()
    docs_dir = Path(settings.documents_dir)
    docs_dir.mkdir(parents=True, exist_ok=True)

    results: list[UploadResult] = []
    for f in files:
        name = Path(f.filename or "").name
        ext = Path(name).suffix.lower()
        if ext not in ALLOWED_EXT:
            results.append(
                UploadResult(
                    filename=name or "unknown",
                    status="rejected",
                    error=f"Unsupported extension {ext}. Allowed: {sorted(ALLOWED_EXT)}",
                )
            )
            continue

        target = docs_dir / name
        try:
            content = await f.read()
            if not content:
                raise ValueError("Empty file")
            target.write_bytes(content)
            log.info("Saved upload: %s (%d bytes)", target.name, len(content))
            result = ingest_document(target)

            # Persist metadata in Mongo (best-effort; RAG succeeded either way).
            try:
                docs_repo.upsert_document(
                    result.document_name,
                    document_type=ext.lstrip("."),
                    file_size=len(content),
                    chunk_count=result.chunks_created,
                    embedding_model=settings.embedding_model,
                )
                analytics_repo.record_event(
                    "upload",
                    {"filename": result.document_name, "chunks": result.chunks_created},
                )
            except MongoUnavailable as e:
                log.warning("Mongo unavailable — metadata not persisted: %s", e)

            results.append(
                UploadResult(
                    filename=result.document_name,
                    status="indexed",
                    chunks=result.chunks_created,
                )
            )
        except ValueError as e:
            log.error("Upload rejected for %s: %s", f.filename, e)
            results.append(
                UploadResult(filename=name or "unknown", status="failed", error=str(e))
            )
        except Exception as e:  # noqa: BLE001
            log.exception("Upload failed for %s", f.filename)
            results.append(
                UploadResult(filename=name or "unknown", status="failed", error=str(e))
            )

    return UploadResponse(uploaded=results)


@router.post("/index", response_model=IndexResponse)
def index_all() -> IndexResponse:
    settings = get_settings()
    try:
        results = reindex_all()
    except Exception as e:  # noqa: BLE001
        log.exception("Reindex failed")
        raise HTTPException(status_code=500, detail=str(e))

    indexed = [
        UploadResult(filename=r.document_name, status="indexed", chunks=r.chunks_created)
        for r in results
    ]
    total = sum(r.chunks_created for r in results)

    # Sync Mongo metadata for reindexed files.
    for r in results:
        try:
            p = Path(settings.documents_dir) / r.document_name
            docs_repo.upsert_document(
                r.document_name,
                document_type=p.suffix.lstrip(".").lower(),
                file_size=p.stat().st_size if p.exists() else 0,
                chunk_count=r.chunks_created,
                embedding_model=settings.embedding_model,
            )
        except MongoUnavailable:
            break
        except Exception as e:  # noqa: BLE001
            log.warning("Metadata sync failed for %s: %s", r.document_name, e)

    return IndexResponse(indexed=indexed, total_chunks=total)


@router.get("/documents", response_model=DocumentsResponse)
def list_documents() -> DocumentsResponse:
    try:
        rows = docs_repo.list_documents()
    except MongoUnavailable:
        raise _mongo_error()
    return DocumentsResponse(documents=[DocumentInfo(**r) for r in rows])


@router.delete("/documents/{name}")
def delete_document(name: str) -> dict:
    settings = get_settings()
    store = get_vector_store()
    removed = store.delete_by_document(name)
    path = Path(settings.documents_dir) / name
    if path.exists():
        path.unlink()
    try:
        docs_repo.delete_document(name)
    except MongoUnavailable:
        log.warning("Mongo unavailable — metadata not removed for %s", name)
    return {"deleted": name, "chunks_removed": removed}
