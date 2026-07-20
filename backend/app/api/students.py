"""Student Management API — Admin & Super Admin only."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from app.core.logging import get_logger
from app.db import MongoUnavailable
from app.middleware.auth import require_admin
from app.services import student_service as svc
from app.services.student_service import StudentServiceError

router = APIRouter(prefix="/students", tags=["students"])
log = get_logger(__name__)


def _client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return req.client.host if req.client else "0.0.0.0"


def _handle(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except StudentServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except MongoUnavailable:
        raise HTTPException(status_code=503, detail="Student store unavailable")


# ─── Schemas ─────────────────────────────────────────────────────────────
class StudentBody(BaseModel):
    rollNumber: str = Field(..., min_length=1, max_length=40)
    fullName: str = Field(..., min_length=1, max_length=160)
    email: EmailStr
    phone: str = Field("", max_length=40)
    department: str = Field("", max_length=120)
    branch: str = Field("", max_length=120)
    year: str = Field("", max_length=20)
    gender: str = Field("", max_length=20)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE|DISABLED|DELETED)$")


class StudentUpdateBody(BaseModel):
    rollNumber: str | None = Field(None, min_length=1, max_length=40)
    fullName: str | None = Field(None, min_length=1, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=40)
    department: str | None = Field(None, max_length=120)
    branch: str | None = Field(None, max_length=120)
    year: str | None = Field(None, max_length=20)
    gender: str | None = Field(None, max_length=20)
    status: str | None = Field(None, pattern="^(ACTIVE|INACTIVE|DISABLED|DELETED)$")


class StatusBody(BaseModel):
    status: str = Field(..., pattern="^(ACTIVE|INACTIVE|DISABLED|DELETED)$")


class BulkImportBody(BaseModel):
    rows: list[dict[str, Any]]


class ExportBody(BaseModel):
    ids: list[str] | None = None
    filters: dict[str, Any] | None = None


# ─── Endpoints ───────────────────────────────────────────────────────────
@router.get("")
def list_students(
    request: Request,
    _: dict = Depends(require_admin),
    search: str = "",
    department: str = "",
    branch: str = "",
    year: str = "",
    status: str = "",
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=200),
    sortBy: str = "createdAt",
    sortDir: str = "desc",
    includeDeleted: bool = False,
):
    return _handle(
        svc.list_students,
        search=search,
        department=department,
        branch=branch,
        year=year,
        status=status,
        include_deleted=includeDeleted,
        skip=(page - 1) * pageSize,
        limit=pageSize,
        sort_by=sortBy,
        sort_dir=-1 if sortDir.lower() == "desc" else 1,
    )


@router.get("/template")
def download_template(_: dict = Depends(require_admin)):
    data = svc.import_template()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="students_template.xlsx"'},
    )


@router.get("/{student_id}")
def get_student(student_id: str, _: dict = Depends(require_admin)):
    return _handle(svc.get_student, student_id)


@router.post("", status_code=201)
def create_student(body: StudentBody, request: Request, actor: dict = Depends(require_admin)):
    return _handle(svc.create_student, body.model_dump(), actor=actor, actor_ip=_client_ip(request))


@router.put("/{student_id}")
def update_student(student_id: str, body: StudentUpdateBody, request: Request,
                   actor: dict = Depends(require_admin)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    return _handle(svc.update_student, student_id, patch, actor=actor, actor_ip=_client_ip(request))


@router.patch("/{student_id}/status")
def change_status(student_id: str, body: StatusBody, request: Request,
                  actor: dict = Depends(require_admin)):
    return _handle(svc.set_status, student_id, body.status, actor=actor, actor_ip=_client_ip(request))


@router.delete("/{student_id}")
def delete_student(student_id: str, request: Request, actor: dict = Depends(require_admin)):
    return _handle(svc.soft_delete, student_id, actor=actor, actor_ip=_client_ip(request))


@router.post("/{student_id}/reset-password")
def reset_password(student_id: str, request: Request, actor: dict = Depends(require_admin)):
    return _handle(svc.reset_password, student_id, actor=actor, actor_ip=_client_ip(request))


@router.post("/bulk-import/preview")
async def preview_import(request: Request, file: UploadFile = File(...),
                         _: dict = Depends(require_admin)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported.")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB).")
    return _handle(svc.parse_excel, data)


@router.post("/bulk-import")
def bulk_import(body: BulkImportBody, request: Request, actor: dict = Depends(require_admin)):
    return _handle(svc.bulk_import, body.rows, actor=actor, actor_ip=_client_ip(request))


@router.post("/export")
def export_students(body: ExportBody, request: Request, actor: dict = Depends(require_admin)):
    data = svc.export_students(
        actor=actor,
        actor_ip=_client_ip(request),
        ids=body.ids,
        filters=body.filters or {},
    )
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="students_export.xlsx"'},
    )
