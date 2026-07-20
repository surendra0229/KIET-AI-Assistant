"""Message repository — messages are always scoped to an owner."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.db import get_db


COLLECTION = "messages"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def add_message(
    chat_id: str,
    *,
    owner_id: str,
    role: str,
    content: str,
    citations: list[dict[str, Any]] | None = None,
    retrieval_time: int | None = None,
    generation_time: int | None = None,
    token_usage: dict[str, Any] | None = None,
) -> dict[str, Any]:
    db = get_db()
    msg = {
        "messageId": str(uuid.uuid4()),
        "chatId": chat_id,
        "ownerId": owner_id,
        "role": role,
        "content": content,
        "citations": citations or [],
        "retrievalTime": retrieval_time,
        "generationTime": generation_time,
        "tokenUsage": token_usage or {},
        "timestamp": _now(),
    }
    db[COLLECTION].insert_one(msg)
    msg.pop("_id", None)
    return msg


def list_messages(chat_id: str, owner_id: str) -> list[dict[str, Any]]:
    db = get_db()
    return list(
        db[COLLECTION]
        .find({"chatId": chat_id, "ownerId": owner_id}, {"_id": 0})
        .sort("timestamp", 1)
    )


def clear_messages(chat_id: str, owner_id: str) -> int:
    db = get_db()
    return db[COLLECTION].delete_many({"chatId": chat_id, "ownerId": owner_id}).deleted_count


def count_messages(owner_id: str | None = None) -> int:
    db = get_db()
    q: dict[str, Any] = {"ownerId": owner_id} if owner_id else {}
    return db[COLLECTION].count_documents(q)


def ensure_indexes() -> None:
    db = get_db()
    db[COLLECTION].create_index([("chatId", 1), ("timestamp", 1)])
    db[COLLECTION].create_index("ownerId")
