"""MongoDB Atlas connection (lazy, safe when MONGODB_URI is unset).

Callers should route requests that require Mongo through `get_db()`. When
`MONGODB_URI` is missing or the server is unreachable, `MongoUnavailable`
is raised — the FastAPI layer converts it to a clean 503 response instead
of crashing the process.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class MongoUnavailable(RuntimeError):
    """Raised when MongoDB is not configured or the connection failed."""


@lru_cache
def _client():
    settings = get_settings()
    if not settings.mongodb_uri:
        raise MongoUnavailable(
            "MONGODB_URI is not configured. Set it in backend/.env to enable persistence."
        )
    # pyrefly: ignore [missing-import]
    from pymongo import MongoClient
    # pyrefly: ignore [missing-import]
    from pymongo.errors import PyMongoError

    try:
        client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000, tz_aware=True)
        client.admin.command("ping")
        log.info("Connected to MongoDB (%s)", settings.mongodb_db)
        return client
    except PyMongoError as e:
        raise MongoUnavailable(f"MongoDB connection failed: {e}") from e


def get_db():
    settings = get_settings()
    client = _client()
    db = client[settings.mongodb_db]
    _ensure_indexes(db)
    return db


_indexes_created = False


def _ensure_indexes(db) -> None:
    global _indexes_created
    if _indexes_created:
        return
    try:
        db.documents.create_index("filename", unique=True)
        db.documents.create_index("uploadedAt")
        db.chat_sessions.create_index("updatedAt")
        db.messages.create_index([("chatId", 1), ("timestamp", 1)])
        db.settings.create_index("key", unique=True)
        db.analytics.create_index("timestamp")
        _indexes_created = True
    except Exception as e:  # noqa: BLE001
        log.warning("Index creation skipped: %s", e)


def mongo_available() -> tuple[bool, Optional[str]]:
    try:
        get_db()
        return True, None
    except MongoUnavailable as e:
        return False, str(e)
    except Exception as e:  # noqa: BLE001
        return False, str(e)
