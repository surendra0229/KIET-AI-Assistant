"""Authentication endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db import MongoUnavailable
from app.middleware.auth import get_current_user
from app.services.admin_service import AdminServiceError
from app.services import admin_service as admin_svc
from app.services.auth_service import AuthError, authenticate

router = APIRouter(prefix="/auth", tags=["auth"])
log = get_logger(__name__)


def _client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return req.client.host if req.client else "0.0.0.0"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    userId: str
    name: str
    email: EmailStr
    role: str
    department: str = ""
    designation: str = ""
    phone: str = ""
    isActive: bool = True
    mustChangePassword: bool = False


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    expiresInMinutes: int
    user: UserResponse
    mustChangePassword: bool = False


class ChangePasswordBody(BaseModel):
    currentPassword: str = Field(..., min_length=1)
    newPassword: str = Field(..., min_length=8)
    confirmPassword: str = Field(..., min_length=8)


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str = Field(..., min_length=8)
    newPassword: str = Field(..., min_length=8)
    confirmPassword: str = Field(..., min_length=8)


def _to_user_response(user: dict[str, Any]) -> UserResponse:
    return UserResponse(
        userId=user.get("userId"),
        name=user.get("name", ""),
        email=user.get("email"),
        role=user.get("role", "STUDENT"),
        department=user.get("department", "") or "",
        designation=user.get("designation", "") or "",
        phone=user.get("phone", "") or "",
        isActive=user.get("isActive", True),
        mustChangePassword=bool(user.get("mustChangePassword", False)),
    )


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    settings = get_settings()
    if not settings.jwt_secret:
        raise HTTPException(status_code=503, detail="Auth not configured: JWT_SECRET missing")
    try:
        token, user = authenticate(str(body.email), body.password)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Auth store unavailable")
    return LoginResponse(
        accessToken=token,
        expiresInMinutes=settings.jwt_expire_minutes,
        user=_to_user_response(user),
        mustChangePassword=bool(user.get("mustChangePassword", False)),
    )


@router.get("/me", response_model=UserResponse)
def me(user: dict[str, Any] = Depends(get_current_user)) -> UserResponse:
    return _to_user_response(user)


@router.post("/logout")
def logout(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    log.info("User logged out: %s", user.get("email"))
    return {"status": "logged_out"}


@router.post("/change-password")
def change_password(
    body: ChangePasswordBody,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, str]:
    if body.newPassword != body.confirmPassword:
        raise HTTPException(status_code=422, detail="New password and confirmation do not match.")
    try:
        admin_svc.change_own_password(
            user["userId"],
            current_password=body.currentPassword,
            new_password=body.newPassword,
            actor_ip=_client_ip(request),
        )
    except AdminServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Auth store unavailable")
    return {"status": "password_changed"}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordBody) -> dict[str, str]:
    # Always respond the same to avoid email enumeration.
    try:
        admin_svc.create_password_reset(str(body.email))
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Auth store unavailable")
    return {"status": "if_account_exists_email_sent"}


@router.post("/reset-password")
def reset_password(body: ResetPasswordBody) -> dict[str, str]:
    if body.newPassword != body.confirmPassword:
        raise HTTPException(status_code=422, detail="New password and confirmation do not match.")
    try:
        admin_svc.apply_password_reset(body.token, body.newPassword)
    except AdminServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Auth store unavailable")
    return {"status": "password_reset"}
