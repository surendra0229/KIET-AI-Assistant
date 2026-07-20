"""FastAPI entrypoint for the KIET AI Assistant backend.

Run locally with:
    uvicorn app.main:app --reload --port 8000
"""
# pyrefly: ignore [missing-import]
from fastapi import Depends, FastAPI

from app.middleware.auth import require_admin, require_any_authenticated
from app.middleware.rate_limit import RateLimitMiddleware
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admins as admins_api,
    auth as auth_api,
    chat,
    chats,
    dashboard,
    documents,
    health,
    settings as settings_api,
    status as status_api,
    students as students_api,
)
from app.middleware.auth import require_super_admin
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.db import mongo_available
from app.services.auth_service import bootstrap_super_admin

setup_logging()
log = get_logger(__name__)
settings = get_settings()

app = FastAPI(
    title="KIET AI Assistant API",
    version="1.2.0",
    description=(
        "Production RAG assistant grounded in college documents. "
        "Auth: JWT + RBAC. Metadata & chats: MongoDB. Embeddings: ChromaDB. LLM: Gemini."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting — protect all routes from brute-force and API abuse.
app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)

app.include_router(health.router, tags=["health"])
app.include_router(auth_api.router)
_admin_dep = [Depends(require_admin)]
_auth_dep = [Depends(require_any_authenticated)]

app.include_router(status_api.router, tags=["status"], dependencies=_admin_dep)
app.include_router(dashboard.router, tags=["dashboard"], dependencies=_admin_dep)
app.include_router(documents.router, tags=["documents"], dependencies=_admin_dep)
app.include_router(settings_api.router, tags=["settings"], dependencies=_admin_dep)
app.include_router(chat.router, tags=["chat"], dependencies=_auth_dep)
app.include_router(chats.router, dependencies=_auth_dep)
app.include_router(admins_api.router, dependencies=[Depends(require_super_admin)])
app.include_router(students_api.router, dependencies=_admin_dep)


@app.on_event("startup")
def _startup_diagnostics() -> None:
    log.info("=" * 60)
    log.info("Application Starting — KIET AI Assistant v1.3.0")
    log.info("=" * 60)

    # ── MongoDB ──────────────────────────────────────────────────────────
    ok, err = mongo_available()
    if ok:
        log.info("MongoDB: Connected (%s)", settings.mongodb_db)
        try:
            from app.repositories import chats as _chats_repo
            from app.repositories import messages as _messages_repo

            _chats_repo.ensure_indexes()
            _messages_repo.ensure_indexes()
        except Exception as e:
            log.warning("Chat index bootstrap skipped: %s", e)
    else:
        log.warning("MongoDB: NOT CONNECTED — %s", err)

    # ================================================================
    # EMBEDDING MODEL PRELOAD DISABLED FOR RENDER FREE PLAN
    # This reduces memory usage during startup.
    # The embedding model will be loaded automatically
    # when it is first needed.
    # ================================================================

    # try:
    #     from app.services.embeddings import get_embedder
    #     embedder = get_embedder()
    #     log.info(
    #         "Embedding Model: Loaded (%s, dim=%d)",
    #         settings.embedding_model,
    #         embedder.dim,
    #     )
    # except Exception as e:
    #     log.warning("Embedding Model: FAILED to pre-load — %s", e)

    # ================================================================
    # CHROMADB PRELOAD DISABLED FOR RENDER FREE PLAN
    # This also helps reduce startup memory usage.
    # ================================================================

    # try:
    #     from app.services.vectordb import get_vector_store
    #     store = get_vector_store()
    #     log.info(
    #         "ChromaDB: Ready (%s, %d items)",
    #         settings.chroma_collection,
    #         store.count(),
    #     )
    # except Exception as e:
    #     log.warning("ChromaDB: FAILED to pre-load — %s", e)

    # ── Gemini ───────────────────────────────────────────────────────────
    if not settings.gemini_api_key:
        log.warning(
            "Gemini: NOT CONFIGURED — GEMINI_API_KEY missing, /chat will return 503"
        )
    else:
        try:
            from app.services.llm.gemini import _model as _gemini_model

            _gemini_model()
            log.info("Gemini: Ready (%s)", settings.gemini_model)
        except Exception as e:
            log.warning("Gemini: FAILED to pre-load — %s", e)

    # ── Auth ─────────────────────────────────────────────────────────────
    if not settings.jwt_secret:
        log.warning("Auth: JWT_SECRET missing — /auth/login will return 503")

    bootstrap_super_admin()
    log.info("Application Ready — accepting requests")


@app.get("/")
def root() -> dict:
    return {
        "name": "KIET AI Assistant API",
        "version": "1.3.0",
        "docs": "/docs",
    }