"""Chat session repository — per-user isolated."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.db import get_db


COLLECTION = "chat_sessions"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _owner_filter(owner_id: str | None) -> dict[str, Any]:
    # Strict isolation: only rows explicitly owned by this user.
    return {"ownerId": owner_id} if owner_id else {"ownerId": {"$exists": False}}


def create_session(
    *,
    owner_id: str,
    owner_role: str,
    title: str = "New chat",
) -> dict[str, Any]:
    db = get_db()
    now = _now()
    session = {
        "chatId": str(uuid.uuid4()),
        "ownerId": owner_id,
        "ownerRole": owner_role,
        "title": title,
        "createdAt": now,
        "updatedAt": now,
        "lastMessage": "",
        "messageCount": 0,
    }
    db[COLLECTION].insert_one(session)
    session.pop("_id", None)
    return session


def list_sessions(*, owner_id: str) -> list[dict[str, Any]]:
    db = get_db()
    return list(
        db[COLLECTION]
        .find({"ownerId": owner_id}, {"_id": 0})
        .sort("updatedAt", -1)
    )


def get_session(chat_id: str) -> dict[str, Any] | None:
    """Raw fetch (no ownership check) — callers MUST enforce ownership."""
    db = get_db()
    return db[COLLECTION].find_one({"chatId": chat_id}, {"_id": 0})


def get_owned_session(chat_id: str, owner_id: str) -> dict[str, Any] | None:
    db = get_db()
    return db[COLLECTION].find_one(
        {"chatId": chat_id, "ownerId": owner_id}, {"_id": 0}
    )


def rename_session(chat_id: str, owner_id: str, title: str) -> int:
    db = get_db()
    return db[COLLECTION].update_one(
        {"chatId": chat_id, "ownerId": owner_id},
        {"$set": {"title": title, "updatedAt": _now()}},
    ).modified_count


def delete_session(chat_id: str, owner_id: str) -> int:
    db = get_db()
    res = db[COLLECTION].delete_one({"chatId": chat_id, "ownerId": owner_id})
    if res.deleted_count:
        db.messages.delete_many({"chatId": chat_id, "ownerId": owner_id})
    return int(res.deleted_count)


def touch_session(
    chat_id: str,
    owner_id: str,
    *,
    last_message: str,
    title: str | None = None,
) -> None:
    db = get_db()
    update: dict[str, Any] = {
        "updatedAt": _now(),
        "lastMessage": last_message[:200],
    }
    if title is not None:
        update["title"] = title[:80]
    db[COLLECTION].update_one(
        {"chatId": chat_id, "ownerId": owner_id},
        {"$set": update, "$inc": {"messageCount": 1}},
    )


def count_sessions(owner_id: str | None = None) -> int:
    db = get_db()
    q: dict[str, Any] = {"ownerId": owner_id} if owner_id else {}
    return db[COLLECTION].count_documents(q)


def ensure_indexes() -> None:
    db = get_db()
    db[COLLECTION].create_index("chatId", unique=True)
    db[COLLECTION].create_index([("ownerId", 1), ("updatedAt", -1)])
