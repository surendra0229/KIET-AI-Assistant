"""Document metadata repository (MongoDB)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db import get_db


COLLECTION = "documents"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def upsert_document(
    filename: str,
    *,
    document_type: str,
    file_size: int,
    chunk_count: int,
    embedding_model: str,
    index_status: str = "indexed",
    created_by: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    now = _now()
    doc = {
        "filename": filename,
        "documentType": document_type,
        "fileSize": file_size,
        "chunkCount": chunk_count,
        "indexStatus": index_status,
        "embeddingModel": embedding_model,
        "updatedAt": now,
        "createdBy": created_by,
    }
    db[COLLECTION].update_one(
        {"filename": filename},
        {"$set": doc, "$setOnInsert": {"uploadedAt": now}},
        upsert=True,
    )
    return db[COLLECTION].find_one({"filename": filename}) or doc


def list_documents() -> list[dict[str, Any]]:
    db = get_db()
    return list(db[COLLECTION].find({}, {"_id": 0}).sort("uploadedAt", -1))


def get_document(filename: str) -> dict[str, Any] | None:
    db = get_db()
    return db[COLLECTION].find_one({"filename": filename}, {"_id": 0})


def delete_document(filename: str) -> int:
    db = get_db()
    return db[COLLECTION].delete_one({"filename": filename}).deleted_count


def count_documents() -> int:
    db = get_db()
    return db[COLLECTION].count_documents({})


def total_chunks() -> int:
    db = get_db()
    agg = list(db[COLLECTION].aggregate([{"$group": {"_id": None, "n": {"$sum": "$chunkCount"}}}]))
    return int(agg[0]["n"]) if agg else 0
