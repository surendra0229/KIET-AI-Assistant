from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ─── Chat ────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    chat_id: str | None = None


class CitationModel(BaseModel):
    document_name: str
    sheet_name: str | None = None
    paragraph_number: int | None = None
    score: float


class ChatResponse(BaseModel):
    reply: str
    citations: list[CitationModel]
    retrieval_ms: int
    generation_ms: int
    query: str
    chat_id: str | None = None


class ChatSessionModel(BaseModel):
    chatId: str
    title: str
    createdAt: datetime
    updatedAt: datetime
    lastMessage: str = ""
    messageCount: int = 0


class ChatSessionsResponse(BaseModel):
    sessions: list[ChatSessionModel]


class MessageModel(BaseModel):
    messageId: str
    chatId: str
    role: str
    content: str
    citations: list[dict[str, Any]] = []
    retrievalTime: int | None = None
    generationTime: int | None = None
    tokenUsage: dict[str, Any] = {}
    timestamp: datetime


class MessagesResponse(BaseModel):
    messages: list[MessageModel]


class RenameChatRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


# ─── Documents ───────────────────────────────────────────────────────────
class UploadResult(BaseModel):
    filename: str
    status: str
    chunks: int | None = None
    error: str | None = None


class UploadResponse(BaseModel):
    uploaded: list[UploadResult]


class IndexResponse(BaseModel):
    indexed: list[UploadResult]
    total_chunks: int


class DocumentInfo(BaseModel):
    filename: str
    documentType: str
    fileSize: int
    chunkCount: int
    indexStatus: str
    embeddingModel: str
    uploadedAt: datetime | None = None
    updatedAt: datetime | None = None


class DocumentsResponse(BaseModel):
    documents: list[DocumentInfo]


# ─── Status ──────────────────────────────────────────────────────────────
class StatusResponse(BaseModel):
    status: str
    documents_on_disk: int
    indexed_documents: int
    total_chunks: int
    embedding_model: str
    llm_model: str
    gemini_configured: bool
    vector_db: str
    mongodb_connected: bool
    mongodb_error: str | None = None


# ─── Settings ────────────────────────────────────────────────────────────
class SettingsPatch(BaseModel):
    geminiApiKey: str | None = None
    chunkSize: int | None = Field(None, ge=100, le=4000)
    chunkOverlap: int | None = Field(None, ge=0, le=1000)
    topK: int | None = Field(None, ge=1, le=20)
    theme: str | None = None
