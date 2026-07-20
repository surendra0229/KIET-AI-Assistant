"""Admin management service — orchestrates repositories + audit + email."""
from __future__ import annotations

from typing import Any

from app.core.logging import get_logger
from app.core.security import hash_password, verify_password
from app.repositories import admin_activity as audit
from app.repositories import password_resets as resets
from app.repositories import users as users_repo
from app.services.email import service as email_service
from app.services.password_gen import (
    PasswordPolicyError,
    generate_strong_password,
    validate_password,
)

log = get_logger(__name__)

ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_ADMIN = "ADMIN"
ROLE_STUDENT = "STUDENT"


class AdminServiceError(Exception):
    """Raised for admin-management errors (mapped to 4xx by the API)."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _ensure_indexes() -> None:
    try:
        users_repo.ensure_indexes()
        audit.ensure_indexes()
        resets.ensure_indexes()
    except Exception as e:  # noqa: BLE001
        log.warning("Admin index bootstrap skipped: %s", e)


# ─── Listing ────────────────────────────────────────────────────────────
def list_admins() -> list[dict[str, Any]]:
    _ensure_indexes()
    return users_repo.list_by_roles([ROLE_ADMIN, ROLE_SUPER_ADMIN])


def get_admin(user_id: str) -> dict[str, Any]:
    user = users_repo.get_by_id(user_id)
    if not user or user.get("role") not in {ROLE_ADMIN, ROLE_SUPER_ADMIN}:
        raise AdminServiceError("Admin not found", 404)
    return user


# ─── Create ─────────────────────────────────────────────────────────────
def create_admin(
    *,
    name: str,
    email: str,
    department: str,
    designation: str,
    phone: str,
    actor: dict[str, Any],
    actor_ip: str | None = None,
) -> tuple[dict[str, Any], str]:
    _ensure_indexes()
    if not name.strip() or not email.strip():
        raise AdminServiceError("Name and email are required.", 422)
    if users_repo.get_by_email(email):
        raise AdminServiceError("An account with this email already exists.", 409)

    temp_password = generate_strong_password(12)
    user = users_repo.create_user(
        name=name,
        email=email,
        password_hash=hash_password(temp_password),
        role=ROLE_ADMIN,
        department=department,
        phone=phone,
        designation=designation,
        is_active=True,
        must_change_password=True,
        created_by=actor.get("userId"),
    )
    audit.log_action(
        action=audit.ACTION_ADMIN_CREATED,
        actor_user_id=actor.get("userId"),
        actor_email=actor.get("email"),
        target_user_id=user["userId"],
        target_email=user["email"],
        ip=actor_ip,
        metadata={"department": user.get("department"), "designation": user.get("designation")},
    )
    email_service.send_admin_welcome(
        to_email=user["email"], name=user["name"], temp_password=temp_password
    )
    return user, temp_password


# ─── Update / Status / Delete ───────────────────────────────────────────
def update_admin(
    user_id: str,
    *,
    name: str | None,
    department: str | None,
    designation: str | None,
    phone: str | None,
    actor: dict[str, Any],
    actor_ip: str | None = None,
) -> dict[str, Any]:
    target = get_admin(user_id)
    updated = users_repo.update_profile(
        user_id,
        name=name,
        department=department,
        designation=designation,
        phone=phone,
    )
    audit.log_action(
        action=audit.ACTION_ADMIN_UPDATED,
        actor_user_id=actor.get("userId"),
        actor_email=actor.get("email"),
        target_user_id=user_id,
        target_email=target["email"],
        ip=actor_ip,
        metadata={"name": name, "department": department, "designation": designation, "phone": phone},
    )
    return updated  # type: ignore[return-value]


def change_status(
    user_id: str,
    status: str,
    *,
    actor: dict[str, Any],
    actor_ip: str | None = None,
) -> dict[str, Any]:
    target = get_admin(user_id)
    if target.get("role") == ROLE_SUPER_ADMIN:
        raise AdminServiceError("Cannot change the status of a Super Admin.", 403)
    if actor.get("userId") == user_id:
        raise AdminServiceError("You cannot change your own status.", 400)
    try:
        updated = users_repo.set_status(user_id, status)
    except ValueError as e:
        raise AdminServiceError(str(e), 422)

    action = (
        audit.ACTION_ADMIN_ENABLED
        if status == users_repo.STATUS_ACTIVE
        else audit.ACTION_ADMIN_DISABLED
        if status == users_repo.STATUS_DISABLED
        else audit.ACTION_ADMIN_STATUS_CHANGED
    )
    audit.log_action(
        action=action,
        actor_user_id=actor.get("userId"),
        actor_email=actor.get("email"),
        target_user_id=user_id,
        target_email=target["email"],
        ip=actor_ip,
        metadata={"status": status},
    )
    return updated  # type: ignore[return-value]


def delete_admin(
    user_id: str,
    *,
    actor: dict[str, Any],
    actor_ip: str | None = None,
) -> None:
    target = get_admin(user_id)
    if target.get("role") == ROLE_SUPER_ADMIN:
        raise AdminServiceError("Cannot delete a Super Admin.", 403)
    if actor.get("userId") == user_id:
        raise AdminServiceError("You cannot delete your own account.", 400)
    users_repo.delete_user(user_id)
    audit.log_action(
        action=audit.ACTION_ADMIN_DELETED,
        actor_user_id=actor.get("userId"),
        actor_email=actor.get("email"),
        target_user_id=user_id,
        target_email=target["email"],
        ip=actor_ip,
    )


def reset_admin_password(
    user_id: str,
    *,
    actor: dict[str, Any],
    actor_ip: str | None = None,
) -> str:
    """Super-admin action — generates a new temp password and marks force-change."""
    target = get_admin(user_id)
    temp = generate_strong_password(12)
    users_repo.set_password(user_id, hash_password(temp), must_change=True)
    audit.log_action(
        action=audit.ACTION_PASSWORD_RESET,
        actor_user_id=actor.get("userId"),
        actor_email=actor.get("email"),
        target_user_id=user_id,
        target_email=target["email"],
        ip=actor_ip,
    )
    email_service.send_admin_welcome(
        to_email=target["email"], name=target["name"], temp_password=temp
    )
    return temp


# ─── Self-service password ──────────────────────────────────────────────
def change_own_password(
    user_id: str,
    *,
    current_password: str,
    new_password: str,
    actor_ip: str | None = None,
) -> None:
    raw = users_repo.get_raw_by_id(user_id)
    is_student = False
    if not raw:
        # Fallback to students collection
        from app.repositories import students as students_repo
        raw = students_repo.get_raw_by_id(user_id)
        is_student = True
    if not raw:
        raise AdminServiceError("User not found.", 404)
    if not verify_password(current_password, raw.get("passwordHash", "")):
        raise AdminServiceError("Current password is incorrect.", 401)
    try:
        validate_password(new_password)
    except PasswordPolicyError as e:
        raise AdminServiceError(str(e), 422)
    if verify_password(new_password, raw.get("passwordHash", "")):
        raise AdminServiceError("New password must differ from the current password.", 422)

    new_hash = hash_password(new_password)
    if is_student:
        from app.repositories import students as students_repo
        students_repo.set_password(user_id, new_hash, must_change=False)
        actor_email = raw.get("email")
    else:
        users_repo.set_password(user_id, new_hash, must_change=False)
        actor_email = raw.get("email")

    audit.log_action(
        action=audit.ACTION_PASSWORD_CHANGED,
        actor_user_id=user_id,
        actor_email=actor_email,
        target_user_id=user_id,
        target_email=actor_email,
        ip=actor_ip,
    )
    email_service.send_password_changed_notice(to_email=actor_email or "")


# ─── Forgot / reset flow (placeholders — no email yet) ──────────────────
def create_password_reset(email: str) -> dict[str, Any] | None:
    _ensure_indexes()
    user = users_repo.get_by_email(email)
    if not user:
        return None
    token = resets.create_token(user["userId"], user["email"])
    email_service.send_password_reset(to_email=user["email"], reset_token=token["token"])
    return token


def apply_password_reset(token: str, new_password: str) -> None:
    entry = resets.get_valid(token)
    if not entry:
        raise AdminServiceError("Reset token is invalid or expired.", 400)
    try:
        validate_password(new_password)
    except PasswordPolicyError as e:
        raise AdminServiceError(str(e), 422)
    users_repo.set_password(entry["userId"], hash_password(new_password), must_change=False)
    resets.mark_used(token)
    audit.log_action(
        action=audit.ACTION_PASSWORD_CHANGED,
        actor_user_id=entry["userId"],
        actor_email=entry.get("email"),
        target_user_id=entry["userId"],
        target_email=entry.get("email"),
        metadata={"via": "reset_token"},
    )
