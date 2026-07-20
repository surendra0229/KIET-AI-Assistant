"""Admin Management API — Super Admin only."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.core.logging import get_logger
from app.db import MongoUnavailable
from app.middleware.auth import require_super_admin
from app.repositories import admin_activity as audit
from app.services.admin_service import AdminServiceError
from app.services import admin_service as svc

router = APIRouter(prefix="/admins", tags=["admins"])
log = get_logger(__name__)


def _client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return req.client.host if req.client else "0.0.0.0"


def _handle(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except AdminServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Admin store unavailable")


# ─── Schemas ─────────────────────────────────────────────────────────────
class AdminOut(BaseModel):
    userId: str
    name: str
    email: EmailStr
    role: str
    department: str = ""
    designation: str = ""
    phone: str = ""
    status: str = "ACTIVE"
    isActive: bool = True
    mustChangePassword: bool = False
    lastLogin: Any | None = None
    createdAt: Any | None = None
    updatedAt: Any | None = None
    createdBy: str | None = None


class CreateAdminBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    department: str = Field("", max_length=120)
    designation: str = Field("", max_length=120)
    phone: str = Field("", max_length=40)


class UpdateAdminBody(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    department: str | None = Field(None, max_length=120)
    designation: str | None = Field(None, max_length=120)
    phone: str | None = Field(None, max_length=40)


class StatusBody(BaseModel):
    status: str = Field(..., pattern="^(ACTIVE|INACTIVE|DISABLED)$")


class CreateAdminResponse(BaseModel):
    admin: AdminOut
    temporaryPassword: str
    emailSent: bool = False


class ResetPasswordResponse(BaseModel):
    temporaryPassword: str
    emailSent: bool = False


# ─── Endpoints ───────────────────────────────────────────────────────────
@router.get("", response_model=list[AdminOut])
def list_admins(_: dict = Depends(require_super_admin)):
    admins = _handle(svc.list_admins)
    return [AdminOut(**a) for a in admins]


@router.post("", response_model=CreateAdminResponse, status_code=201)
def create_admin(
    body: CreateAdminBody,
    request: Request,
    actor: dict = Depends(require_super_admin),
):
    admin, temp = _handle(
        svc.create_admin,
        name=body.name,
        email=str(body.email),
        department=body.department,
        designation=body.designation,
        phone=body.phone,
        actor=actor,
        actor_ip=_client_ip(request),
    )
    return CreateAdminResponse(admin=AdminOut(**admin), temporaryPassword=temp, emailSent=False)


@router.get("/{user_id}", response_model=AdminOut)
def get_admin(user_id: str, _: dict = Depends(require_super_admin)):
    return AdminOut(**_handle(svc.get_admin, user_id))


@router.patch("/{user_id}", response_model=AdminOut)
def update_admin(
    user_id: str,
    body: UpdateAdminBody,
    request: Request,
    actor: dict = Depends(require_super_admin),
):
    updated = _handle(
        svc.update_admin,
        user_id,
        name=body.name,
        department=body.department,
        designation=body.designation,
        phone=body.phone,
        actor=actor,
        actor_ip=_client_ip(request),
    )
    return AdminOut(**updated)


@router.patch("/{user_id}/status", response_model=AdminOut)
def change_status(
    user_id: str,
    body: StatusBody,
    request: Request,
    actor: dict = Depends(require_super_admin),
):
    updated = _handle(
        svc.change_status, user_id, body.status, actor=actor, actor_ip=_client_ip(request)
    )
    return AdminOut(**updated)


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    user_id: str,
    request: Request,
    actor: dict = Depends(require_super_admin),
):
    temp = _handle(svc.reset_admin_password, user_id, actor=actor, actor_ip=_client_ip(request))
    return ResetPasswordResponse(temporaryPassword=temp, emailSent=False)


@router.delete("/{user_id}", status_code=204)
def delete_admin(
    user_id: str,
    request: Request,
    actor: dict = Depends(require_super_admin),
):
    _handle(svc.delete_admin, user_id, actor=actor, actor_ip=_client_ip(request))
    return None


@router.get("/{user_id}/activity")
def get_activity(user_id: str, _: dict = Depends(require_super_admin)):
    try:
        return {"events": audit.list_for_target(user_id, limit=200)}
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Audit store unavailable")


@router.get("/-/activity/recent")
def recent_activity(_: dict = Depends(require_super_admin)):
    try:
        return {"events": audit.list_recent(limit=200)}
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Audit store unavailable")
