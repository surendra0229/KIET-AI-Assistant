"""User-configurable settings persisted in MongoDB."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db import get_db


COLLECTION = "settings"
KEY = "app"

DEFAULTS: dict[str, Any] = {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "topK": 5,
    "theme": "dark",
    "geminiApiKeyConfigured": False,
}


def get_settings_doc() -> dict[str, Any]:
    db = get_db()
    doc = db[COLLECTION].find_one({"key": KEY}, {"_id": 0}) or {}
    return {**DEFAULTS, **{k: v for k, v in doc.items() if k != "key"}}


def update_settings(patch: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    clean = {k: v for k, v in patch.items() if v is not None}
    clean["updatedAt"] = datetime.now(timezone.utc)
    db[COLLECTION].update_one({"key": KEY}, {"$set": clean}, upsert=True)
    return get_settings_doc()
