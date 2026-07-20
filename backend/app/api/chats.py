"""Chat session API — every operation is scoped to the authenticated user."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.db import MongoUnavailable
from app.middleware.auth import get_current_user
from app.repositories import chats as chats_repo
from app.repositories import messages as messages_repo
from app.schemas import (
    ChatSessionModel,
    ChatSessionsResponse,
    MessageModel,
    MessagesResponse,
    RenameChatRequest,
)

router = APIRouter(prefix="/chats", tags=["chats"])


def _mongo_error() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="MongoDB is not available. Set MONGODB_URI in backend/.env.",
    )


def _require_owned(chat_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """Load a session, enforcing ownership. 404 if missing, 403 if not owner."""
    session = chats_repo.get_session(chat_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat not found")
    if session.get("ownerId") != user["userId"]:
        raise HTTPException(status_code=403, detail="You do not have access to this chat")
    return session


@router.get("", response_model=ChatSessionsResponse)
def list_chats(user: dict = Depends(get_current_user)) -> ChatSessionsResponse:
    try:
        sessions = chats_repo.list_sessions(owner_id=user["userId"])
    except MongoUnavailable:
        raise _mongo_error()
    return ChatSessionsResponse(sessions=[ChatSessionModel(**s) for s in sessions])


@router.post("", response_model=ChatSessionModel)
def create_chat(user: dict = Depends(get_current_user)) -> ChatSessionModel:
    try:
        s = chats_repo.create_session(owner_id=user["userId"], owner_role=user.get("role", ""))
    except MongoUnavailable:
        raise _mongo_error()
    return ChatSessionModel(**s)


@router.get("/{chat_id}/messages", response_model=MessagesResponse)
def list_chat_messages(chat_id: str, user: dict = Depends(get_current_user)) -> MessagesResponse:
    try:
        _require_owned(chat_id, user)
        msgs = messages_repo.list_messages(chat_id, user["userId"])
    except MongoUnavailable:
        raise _mongo_error()
    return MessagesResponse(messages=[MessageModel(**m) for m in msgs])


@router.patch("/{chat_id}", response_model=ChatSessionModel)
def rename_chat(
    chat_id: str, body: RenameChatRequest, user: dict = Depends(get_current_user)
) -> ChatSessionModel:
    try:
        _require_owned(chat_id, user)
        chats_repo.rename_session(chat_id, user["userId"], body.title)
        s = chats_repo.get_owned_session(chat_id, user["userId"])
    except MongoUnavailable:
        raise _mongo_error()
    if not s:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatSessionModel(**s)


@router.delete("/{chat_id}")
def delete_chat(chat_id: str, user: dict = Depends(get_current_user)) -> dict:
    try:
        _require_owned(chat_id, user)
        deleted = chats_repo.delete_session(chat_id, user["userId"])
    except MongoUnavailable:
        raise _mongo_error()
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"deleted": chat_id}


@router.delete("/{chat_id}/messages")
def clear_chat_messages(chat_id: str, user: dict = Depends(get_current_user)) -> dict:
    try:
        _require_owned(chat_id, user)
        removed = messages_repo.clear_messages(chat_id, user["userId"])
    except MongoUnavailable:
        raise _mongo_error()
    return {"cleared": removed}
