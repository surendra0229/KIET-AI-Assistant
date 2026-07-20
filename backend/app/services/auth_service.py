"""Authentication service — login and super-admin bootstrap."""
from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import create_access_token, hash_password, verify_password
from app.db import MongoUnavailable
from app.repositories import users as users_repo

log = get_logger(__name__)

ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_ADMIN = "ADMIN"
ROLE_STUDENT = "STUDENT"
ALLOWED_ROLES = {ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_STUDENT}


class AuthError(Exception):
    """Raised for authentication failures (401)."""


def authenticate(email: str, password: str) -> tuple[str, dict[str, Any]]:
    """Verify credentials against admins/super-admins, then students. Returns (token, safe_user)."""
    if not email or not password:
        raise AuthError("Email and password are required")

    user = users_repo.get_by_email(email)
    if user:
        if not user.get("isActive", True):
            raise AuthError("Account is disabled")
        if not verify_password(password, user.get("passwordHash", "")):
            raise AuthError("Invalid email or password")
        users_repo.update_last_login(user["userId"])
        token = create_access_token(subject=user["userId"], role=user["role"])
        safe = {k: v for k, v in user.items() if k not in {"_id", "passwordHash"}}
        return token, safe

    # Fallback: students
    from app.repositories import students as students_repo
    student = students_repo.get_by_email(email)
    if not student:
        raise AuthError("Invalid email or password")
    if student.get("status") not in {"ACTIVE"}:
        raise AuthError("Account is disabled")
    if not verify_password(password, student.get("passwordHash", "")):
        raise AuthError("Invalid email or password")

    students_repo.update_last_login(student["studentId"])
    token = create_access_token(subject=student["studentId"], role=ROLE_STUDENT)
    safe = {
        "userId": student["studentId"],
        "name": student.get("fullName", ""),
        "email": student.get("email", ""),
        "role": ROLE_STUDENT,
        "department": student.get("department", ""),
        "designation": "",
        "phone": student.get("phone", ""),
        "isActive": True,
        "mustChangePassword": bool(student.get("mustChangePassword", False)),
    }
    return token, safe


def bootstrap_super_admin() -> None:
    """Create the initial super-admin from env vars if none exists."""
    settings = get_settings()
    name = settings.super_admin_name.strip()
    email = settings.super_admin_email.strip()
    password = settings.super_admin_password

    if not (name and email and password):
        log.warning(
            "Super-admin bootstrap skipped: SUPER_ADMIN_NAME / EMAIL / PASSWORD not fully set."
        )
        return

    try:
        users_repo.ensure_indexes()
        if users_repo.get_by_email(email):
            log.info("Super-admin with email %s already exists — bootstrap skipped.", email)
            return
        users_repo.create_user(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role=ROLE_SUPER_ADMIN,
            department="Administration",
        )
        log.info("Super-admin bootstrapped: %s", email)
    except MongoUnavailable as e:
        log.warning("Super-admin bootstrap skipped — MongoDB unavailable: %s", e)
    except Exception as e:  # noqa: BLE001
        log.exception("Super-admin bootstrap failed: %s", e)
