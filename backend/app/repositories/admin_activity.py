"""Audit log for administrator actions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db import get_db

COLLECTION = "admin_activity"

# Action constants
ACTION_ADMIN_CREATED = "ADMIN_CREATED"
ACTION_ADMIN_UPDATED = "ADMIN_UPDATED"
ACTION_ADMIN_DELETED = "ADMIN_DELETED"
ACTION_ADMIN_DISABLED = "ADMIN_DISABLED"
ACTION_ADMIN_ENABLED = "ADMIN_ENABLED"
ACTION_ADMIN_STATUS_CHANGED = "ADMIN_STATUS_CHANGED"
ACTION_PASSWORD_RESET = "PASSWORD_RESET"
ACTION_PASSWORD_CHANGED = "PASSWORD_CHANGED"
ACTION_LOGIN = "LOGIN"


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    d = dict(doc)
    d.pop("_id", None)
    return d


def ensure_indexes() -> None:
    db = get_db()
    db[COLLECTION].create_index([("timestamp", -1)])
    db[COLLECTION].create_index("targetUserId")
    db[COLLECTION].create_index("actorUserId")


def log_action(
    *,
    action: str,
    actor_user_id: str | None,
    actor_email: str | None,
    target_user_id: str | None = None,
    target_email: str | None = None,
    ip: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    try:
        db = get_db()
        db[COLLECTION].insert_one(
            {
                "eventId": str(uuid4()),
                "action": action,
                "actorUserId": actor_user_id,
                "actorEmail": actor_email,
                "targetUserId": target_user_id,
                "targetEmail": target_email,
                "ip": ip or "0.0.0.0",  # placeholder
                "metadata": metadata or {},
                "timestamp": datetime.now(timezone.utc),
            }
        )
    except Exception:
        # Never let audit failures break the primary operation.
        pass


def list_for_target(target_user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    db = get_db()
    cursor = (
        db[COLLECTION]
        .find({"targetUserId": target_user_id})
        .sort("timestamp", -1)
        .limit(limit)
    )
    return [_serialize(d) for d in cursor]


def list_recent(limit: int = 200) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db[COLLECTION].find({}).sort("timestamp", -1).limit(limit)
    return [_serialize(d) for d in cursor]
