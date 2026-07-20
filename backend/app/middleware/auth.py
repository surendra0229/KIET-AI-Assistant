"""FastAPI auth dependencies — extract user from JWT and enforce roles."""
from __future__ import annotations

from typing import Any, Iterable

from fastapi import Depends, Header, HTTPException, status
import jwt

from app.core.security import decode_access_token
from app.db import MongoUnavailable
from app.repositories import users as users_repo
from app.services.auth_service import ROLE_ADMIN, ROLE_STUDENT, ROLE_SUPER_ADMIN


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str = "Insufficient permissions") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized()
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise _unauthorized("Invalid token payload")

    role = payload.get("role")
    try:
        user = users_repo.get_by_id(user_id)
        if not user and role == ROLE_STUDENT:
            from app.repositories import students as students_repo
            s = students_repo.get_by_id(user_id)
            if s:
                user = {
                    "userId": s["studentId"],
                    "name": s.get("fullName", ""),
                    "email": s.get("email", ""),
                    "role": ROLE_STUDENT,
                    "department": s.get("department", ""),
                    "designation": "",
                    "phone": s.get("phone", ""),
                    "isActive": s.get("status") == "ACTIVE",
                    "mustChangePassword": bool(s.get("mustChangePassword", False)),
                }
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Auth store unavailable")

    if not user or not user.get("isActive", True):
        raise _unauthorized("User no longer exists or is disabled")
    return user


def require_roles(*roles: str):
    allowed = set(roles)

    def _dep(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if user.get("role") not in allowed:
            raise _forbidden()
        return user

    return _dep


def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user.get("role") not in {ROLE_SUPER_ADMIN, ROLE_ADMIN}:
        raise _forbidden()
    return user


def require_super_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user.get("role") != ROLE_SUPER_ADMIN:
        raise _forbidden()
    return user


def require_any_authenticated(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return user


__all__ = [
    "get_current_user",
    "require_roles",
    "require_admin",
    "require_super_admin",
    "require_any_authenticated",
    "ROLE_ADMIN",
    "ROLE_STUDENT",
    "ROLE_SUPER_ADMIN",
]
