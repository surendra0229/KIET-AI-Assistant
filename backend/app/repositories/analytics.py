"""Lightweight analytics event log — optionally scoped by owner."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.db import get_db


COLLECTION = "analytics"


def record_event(
    event_type: str,
    payload: dict[str, Any] | None = None,
    *,
    owner_id: str | None = None,
) -> None:
    db = get_db()
    doc: dict[str, Any] = {
        "type": event_type,
        "payload": payload or {},
        "timestamp": datetime.now(timezone.utc),
    }
    if owner_id:
        doc["ownerId"] = owner_id
    db[COLLECTION].insert_one(doc)


def _scope(owner_id: str | None) -> dict[str, Any]:
    return {"ownerId": owner_id} if owner_id else {}


def summarize(*, owner_id: str | None = None) -> dict[str, Any]:
    """Aggregate averages and counts for the dashboard.

    When ``owner_id`` is given, restrict to that user's events (chat-scoped).
    Uploads are always global (documents are institution-wide).
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    def _avg(field: str) -> float:
        match: dict[str, Any] = {"type": "chat", f"payload.{field}": {"$gt": 0}}
        match.update(_scope(owner_id))
        agg = list(
            db[COLLECTION].aggregate(
                [
                    {"$match": match},
                    {"$group": {"_id": None, "avg": {"$avg": f"$payload.{field}"}}},
                ]
            )
        )
        return round(float(agg[0]["avg"]), 2) if agg else 0.0

    def _count(event_type: str, since: datetime | None = None, scoped: bool = True) -> int:
        q: dict[str, Any] = {"type": event_type}
        if since:
            q["timestamp"] = {"$gte": since}
        if scoped:
            q.update(_scope(owner_id))
        return db[COLLECTION].count_documents(q)

    return {
        "chats7d": _count("chat", week_ago, scoped=True),
        "uploads7d": _count("upload", week_ago, scoped=False),
        "avgRetrievalMs": _avg("retrievalMs"),
        "avgGenerationMs": _avg("generationMs"),
    }


def daily_query_volume(days: int = 7, *, owner_id: str | None = None) -> list[dict[str, Any]]:
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=days)
    match: dict[str, Any] = {"type": "chat", "timestamp": {"$gte": since}}
    match.update(_scope(owner_id))
    agg = list(
        db[COLLECTION].aggregate(
            [
                {"$match": match},
                {
                    "$group": {
                        "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                        "count": {"$sum": 1},
                    }
                },
                {"$sort": {"_id": 1}},
            ]
        )
    )
    return [{"date": r["_id"], "count": int(r["count"])} for r in agg]
