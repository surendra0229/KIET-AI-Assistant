from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.core.logging import get_logger
from app.db import MongoUnavailable
from app.middleware.auth import get_current_user
from app.repositories import analytics as analytics_repo
from app.repositories import chats as chats_repo
from app.repositories import messages as messages_repo
from app.schemas import ChatRequest, ChatResponse, CitationModel
from app.services.llm import GeminiError
from app.services.rag import answer_question

router = APIRouter()
log = get_logger(__name__)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: dict = Depends(get_current_user)) -> ChatResponse:
    log.info("Chat started: user=%s", user.get("userId", "unknown"))
    try:
        result = answer_question(payload.message)
    except GeminiError as e:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except asyncio.CancelledError:
        log.info("Chat cancelled: user=%s", user.get("userId", "unknown"))
        raise
    except Exception as e:  # noqa: BLE001
        log.exception("Chat failed")
        raise HTTPException(status_code=500, detail=str(e))

    citations = [CitationModel(**c.__dict__) for c in result.citations]
    owner_id = user["userId"]
    owner_role = user.get("role", "")

    # Persist to Mongo when configured — RAG still returns even if Mongo is down.
    chat_id = payload.chat_id
    try:
        if chat_id:
            existing = chats_repo.get_session(chat_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Chat not found")
            if existing.get("ownerId") != owner_id:
                raise HTTPException(status_code=403, detail="You do not have access to this chat")
        else:
            session = chats_repo.create_session(
                owner_id=owner_id,
                owner_role=owner_role,
                title=payload.message[:60] or "New chat",
            )
            chat_id = session["chatId"]

        messages_repo.add_message(chat_id, owner_id=owner_id, role="user", content=payload.message)
        messages_repo.add_message(
            chat_id,
            owner_id=owner_id,
            role="assistant",
            content=result.answer,
            citations=[c.model_dump() for c in citations],
            retrieval_time=result.retrieval_ms,
            generation_time=result.generation_ms,
        )
        chats_repo.touch_session(
            chat_id,
            owner_id,
            last_message=result.answer,
            title=payload.message[:60] if len(payload.message) else None,
        )
        analytics_repo.record_event(
            "chat",
            {
                "chatId": chat_id,
                "retrievalMs": result.retrieval_ms,
                "generationMs": result.generation_ms,
                "citations": len(citations),
            },
            owner_id=owner_id,
        )
    except HTTPException:
        raise
    except MongoUnavailable as e:
        log.warning("Mongo unavailable — chat not persisted: %s", e)

    return ChatResponse(
        reply=result.answer,
        citations=citations,
        retrieval_ms=result.retrieval_ms,
        generation_ms=result.generation_ms,
        query=payload.message,
        chat_id=chat_id,
    )
