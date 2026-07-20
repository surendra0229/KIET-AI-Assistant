"""Students repository — MongoDB persistence."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4

from app.db import get_db

COLLECTION = "students"

STATUS_ACTIVE = "ACTIVE"
STATUS_INACTIVE = "INACTIVE"
STATUS_DELETED = "DELETED"
STATUS_DISABLED = "DISABLED"
ALLOWED_STATUSES = {STATUS_ACTIVE, STATUS_INACTIVE, STATUS_DELETED, STATUS_DISABLED}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


def _norm_roll(roll: str) -> str:
    return (roll or "").strip().upper()


def _serialize(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    d = dict(doc)
    d.pop("_id", None)
    d.pop("passwordHash", None)
    return d


def ensure_indexes() -> None:
    db = get_db()
    db[COLLECTION].create_index("studentId", unique=True)
    db[COLLECTION].create_index("rollNumber", unique=True)
    db[COLLECTION].create_index("email", unique=True)
    db[COLLECTION].create_index("department")
    db[COLLECTION].create_index("branch")
    db[COLLECTION].create_index("year")
    db[COLLECTION].create_index("status")


def get_by_id(student_id: str) -> dict[str, Any] | None:
    return _serialize(get_db()[COLLECTION].find_one({"studentId": student_id}))


def get_raw_by_id(student_id: str) -> dict[str, Any] | None:
    return get_db()[COLLECTION].find_one({"studentId": student_id})


def get_by_email(email: str) -> dict[str, Any] | None:
    return get_db()[COLLECTION].find_one({"email": _norm_email(email)})


def get_by_roll(roll: str) -> dict[str, Any] | None:
    return get_db()[COLLECTION].find_one({"rollNumber": _norm_roll(roll)})


def create_student(
    *,
    roll_number: str,
    full_name: str,
    email: str,
    phone: str = "",
    department: str = "",
    branch: str = "",
    year: str = "",
    gender: str = "",
    status: str = STATUS_ACTIVE,
    password_hash: str,
    must_change_password: bool = True,
    created_by: str | None = None,
) -> dict[str, Any]:
    if status not in ALLOWED_STATUSES:
        status = STATUS_ACTIVE
    now = _now()
    doc = {
        "studentId": str(uuid4()),
        "rollNumber": _norm_roll(roll_number),
        "fullName": full_name.strip(),
        "email": _norm_email(email),
        "phone": (phone or "").strip(),
        "department": (department or "").strip(),
        "branch": (branch or "").strip(),
        "year": str(year or "").strip(),
        "gender": (gender or "").strip(),
        "status": status,
        "passwordHash": password_hash,
        "mustChangePassword": must_change_password,
        "createdBy": created_by,
        "createdAt": now,
        "updatedAt": now,
        "lastLogin": None,
    }
    get_db()[COLLECTION].insert_one(doc)
    return _serialize(doc)  # type: ignore[return-value]


def update_student(student_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    if not patch:
        return get_by_id(student_id)
    clean: dict[str, Any] = {}
    for k in (
        "fullName",
        "email",
        "phone",
        "department",
        "branch",
        "year",
        "gender",
        "status",
        "rollNumber",
    ):
        if k in patch and patch[k] is not None:
            v = patch[k]
            if k == "email":
                v = _norm_email(str(v))
            elif k == "rollNumber":
                v = _norm_roll(str(v))
            elif isinstance(v, str):
                v = v.strip()
            else:
                v = str(v).strip()
            clean[k] = v
    if not clean:
        return get_by_id(student_id)
    clean["updatedAt"] = _now()
    get_db()[COLLECTION].update_one({"studentId": student_id}, {"$set": clean})
    return get_by_id(student_id)


def set_status(student_id: str, status: str) -> dict[str, Any] | None:
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    get_db()[COLLECTION].update_one(
        {"studentId": student_id},
        {"$set": {"status": status, "updatedAt": _now()}},
    )
    return get_by_id(student_id)


def set_password(student_id: str, password_hash: str, must_change: bool = True) -> None:
    get_db()[COLLECTION].update_one(
        {"studentId": student_id},
        {
            "$set": {
                "passwordHash": password_hash,
                "mustChangePassword": must_change,
                "updatedAt": _now(),
            }
        },
    )


def update_last_login(student_id: str) -> None:
    get_db()[COLLECTION].update_one(
        {"studentId": student_id},
        {"$set": {"lastLogin": _now(), "updatedAt": _now()}},
    )


def hard_delete(student_id: str) -> int:
    return int(get_db()[COLLECTION].delete_one({"studentId": student_id}).deleted_count)


def list_students(
    *,
    search: str = "",
    department: str = "",
    branch: str = "",
    year: str = "",
    status: str = "",
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 25,
    sort_by: str = "createdAt",
    sort_dir: int = -1,
    ids: Iterable[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    q: dict[str, Any] = {}
    if not include_deleted:
        q["status"] = {"$ne": STATUS_DELETED}
    if status:
        q["status"] = status
    if department:
        q["department"] = department
    if branch:
        q["branch"] = branch
    if year:
        q["year"] = str(year)
    if ids is not None:
        q["studentId"] = {"$in": list(ids)}
    if search:
        s = search.strip()
        q["$or"] = [
            {"fullName": {"$regex": s, "$options": "i"}},
            {"email": {"$regex": s, "$options": "i"}},
            {"rollNumber": {"$regex": s, "$options": "i"}},
        ]
    db = get_db()
    total = db[COLLECTION].count_documents(q)
    cursor = db[COLLECTION].find(q).sort(sort_by, sort_dir).skip(max(0, skip)).limit(max(1, min(limit, 500)))
    return [_serialize(d) for d in cursor], int(total)  # type: ignore[misc]


def facets() -> dict[str, list[str]]:
    db = get_db()
    out: dict[str, list[str]] = {}
    for field in ("department", "branch", "year"):
        vals = [v for v in db[COLLECTION].distinct(field) if v]
        vals.sort(key=lambda x: str(x))
        out[field] = [str(v) for v in vals]
    return out
