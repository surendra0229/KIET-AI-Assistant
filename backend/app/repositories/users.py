"""User repository — MongoDB persistence for authentication & admin mgmt."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4

from app.db import get_db

COLLECTION = "users"

# Status values
STATUS_ACTIVE = "ACTIVE"
STATUS_INACTIVE = "INACTIVE"
STATUS_DISABLED = "DISABLED"
ALLOWED_STATUSES = {STATUS_ACTIVE, STATUS_INACTIVE, STATUS_DISABLED}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _serialize(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("passwordHash", None)
    # Backfill defaults for legacy docs
    doc.setdefault("phone", "")
    doc.setdefault("designation", "")
    doc.setdefault("status", STATUS_ACTIVE if doc.get("isActive", True) else STATUS_DISABLED)
    doc.setdefault("mustChangePassword", False)
    doc.setdefault("createdBy", None)
    return doc


def ensure_indexes() -> None:
    db = get_db()
    db[COLLECTION].create_index("email", unique=True)
    db[COLLECTION].create_index("userId", unique=True)
    db[COLLECTION].create_index("role")
    db[COLLECTION].create_index("status")


def get_by_email(email: str) -> dict[str, Any] | None:
    db = get_db()
    return db[COLLECTION].find_one({"email": _normalize_email(email)})


def get_by_id(user_id: str) -> dict[str, Any] | None:
    db = get_db()
    return _serialize(db[COLLECTION].find_one({"userId": user_id}))


def get_raw_by_id(user_id: str) -> dict[str, Any] | None:
    db = get_db()
    return db[COLLECTION].find_one({"userId": user_id})


def create_user(
    *,
    name: str,
    email: str,
    password_hash: str,
    role: str,
    department: str | None = None,
    phone: str | None = None,
    designation: str | None = None,
    is_active: bool = True,
    must_change_password: bool = False,
    created_by: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    now = _now()
    doc = {
        "userId": str(uuid4()),
        "name": name.strip(),
        "email": _normalize_email(email),
        "passwordHash": password_hash,
        "role": role,
        "department": (department or "").strip(),
        "phone": (phone or "").strip(),
        "designation": (designation or "").strip(),
        "isActive": is_active,
        "status": STATUS_ACTIVE if is_active else STATUS_DISABLED,
        "mustChangePassword": must_change_password,
        "lastLogin": None,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": created_by,
    }
    db[COLLECTION].insert_one(doc)
    return _serialize(doc)  # type: ignore[return-value]


def update_last_login(user_id: str) -> None:
    db = get_db()
    db[COLLECTION].update_one(
        {"userId": user_id},
        {"$set": {"lastLogin": _now(), "updatedAt": _now()}},
    )


def count_by_role(role: str) -> int:
    db = get_db()
    return db[COLLECTION].count_documents({"role": role})


# ─── Admin management ────────────────────────────────────────────────────
def list_by_roles(roles: Iterable[str]) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db[COLLECTION].find({"role": {"$in": list(roles)}}).sort("createdAt", -1)
    return [_serialize(d) for d in cursor]  # type: ignore[misc]


def update_profile(
    user_id: str,
    *,
    name: str | None = None,
    department: str | None = None,
    phone: str | None = None,
    designation: str | None = None,
) -> dict[str, Any] | None:
    db = get_db()
    patch: dict[str, Any] = {"updatedAt": _now()}
    if name is not None:
        patch["name"] = name.strip()
    if department is not None:
        patch["department"] = department.strip()
    if phone is not None:
        patch["phone"] = phone.strip()
    if designation is not None:
        patch["designation"] = designation.strip()
    db[COLLECTION].update_one({"userId": user_id}, {"$set": patch})
    return get_by_id(user_id)


def set_status(user_id: str, status: str) -> dict[str, Any] | None:
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    db = get_db()
    db[COLLECTION].update_one(
        {"userId": user_id},
        {
            "$set": {
                "status": status,
                "isActive": status == STATUS_ACTIVE,
                "updatedAt": _now(),
            }
        },
    )
    return get_by_id(user_id)


def set_password(user_id: str, password_hash: str, must_change: bool = False) -> None:
    db = get_db()
    db[COLLECTION].update_one(
        {"userId": user_id},
        {
            "$set": {
                "passwordHash": password_hash,
                "mustChangePassword": must_change,
                "updatedAt": _now(),
            }
        },
    )


def delete_user(user_id: str) -> int:
    db = get_db()
    res = db[COLLECTION].delete_one({"userId": user_id})
    return int(res.deleted_count)
