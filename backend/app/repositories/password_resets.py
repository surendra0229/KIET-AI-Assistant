"""Password reset token repository (placeholder — email delivery pending)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db import get_db

COLLECTION = "password_resets"
TOKEN_TTL_MINUTES = 60


def ensure_indexes() -> None:
    db = get_db()
    db[COLLECTION].create_index("token", unique=True)
    db[COLLECTION].create_index("userId")
    db[COLLECTION].create_index("expiresAt")


def create_token(user_id: str, email: str) -> dict[str, Any]:
    db = get_db()
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    doc = {
        "token": token,
        "userId": user_id,
        "email": email,
        "used": False,
        "createdAt": now,
        "expiresAt": now + timedelta(minutes=TOKEN_TTL_MINUTES),
    }
    db[COLLECTION].insert_one(doc)
    doc.pop("_id", None)
    return doc


def get_valid(token: str) -> dict[str, Any] | None:
    db = get_db()
    doc = db[COLLECTION].find_one({"token": token, "used": False})
    if not doc:
        return None
    if doc["expiresAt"] < datetime.now(timezone.utc):
        return None
    doc.pop("_id", None)
    return doc


def mark_used(token: str) -> None:
    db = get_db()
    db[COLLECTION].update_one({"token": token}, {"$set": {"used": True}})
