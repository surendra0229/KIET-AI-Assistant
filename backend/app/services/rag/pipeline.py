"""End-to-end RAG orchestration.

Ingest: load → clean → chunk → embed → upsert into Chroma.
Answer: embed query → top-k retrieve → prompt → Gemini → cite sources.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.chunker import chunk_loaded
from app.services.embeddings import get_embedder
from app.services.llm import GeminiError, generate_answer
from app.services.loaders import load_document
from app.services.prompts import NO_ANSWER, build_rag_prompt
from app.services.vectordb import get_vector_store
from app.services.vectordb.store import RetrievedChunk

log = get_logger(__name__)

# Below this retrieval similarity we treat the corpus as "no relevant match".
MIN_SCORE = 0.25

# ---------------------------------------------------------------------------
# Regex patterns to strip any source-citation markup the LLM might echo back.
# These are belt-and-suspenders; the prompt already forbids them.
# Pattern A: [Source N | ...] or [Source N]
_RE_BRACKET_SOURCE = re.compile(r"\s*\[Source\s+[^\]]*\]\s*", re.IGNORECASE)
# Pattern B: (Source N | ...) or (Source: file.pdf) or (Source N)
_RE_PAREN_SOURCE = re.compile(r"\s*\(Source[^)]*\)\s*", re.IGNORECASE)
# Pattern C: orphaned metadata fragments like "document=x.pdf" or "paragraph=3"
_RE_META_FRAGMENT = re.compile(
    r"\s*(?:document|sheet|paragraph)=[^\s,;)\]]+\s*", re.IGNORECASE
)


@dataclass
class IngestResult:
    document_name: str
    chunks_created: int
    duration_ms: int


@dataclass
class Citation:
    document_name: str
    sheet_name: str | None
    paragraph_number: int | None
    score: float


@dataclass
class AnswerResult:
    answer: str
    citations: list[Citation]
    retrieval_ms: int
    generation_ms: int


def ingest_document(path: str | Path) -> IngestResult:
    settings = get_settings()
    p = Path(path)
    log.info("Ingesting document: %s", p.name)
    t0 = time.perf_counter()

    loaded = load_document(p)
    if not loaded:
        raise ValueError(f"Document is empty: {p.name}")

    chunks = chunk_loaded(
        loaded, chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap
    )
    if not chunks:
        raise ValueError(f"No chunks produced from: {p.name}")
    log.info("Chunked %s → %d chunks", p.name, len(chunks))

    embedder = get_embedder()
    embeddings = embedder.embed([c.text for c in chunks])
    log.info("Embedded %d chunks", len(embeddings))

    store = get_vector_store()
    store.delete_by_document(p.name)  # replace-on-reingest
    store.add(
        ids=[c.id for c in chunks],
        embeddings=embeddings,
        documents=[c.text for c in chunks],
        metadatas=[_sanitize_meta(c.metadata) for c in chunks],
    )
    dur = int((time.perf_counter() - t0) * 1000)
    log.info("Indexed %s in %dms", p.name, dur)
    return IngestResult(document_name=p.name, chunks_created=len(chunks), duration_ms=dur)


def reindex_all() -> list[IngestResult]:
    settings = get_settings()
    docs_dir = Path(settings.documents_dir)
    results: list[IngestResult] = []
    for f in sorted(docs_dir.glob("*")):
        if f.suffix.lower() not in {".docx", ".xlsx", ".xlsm", ".pdf", ".txt"}:
            continue
        try:
            results.append(ingest_document(f))
        except Exception as e:  # noqa: BLE001
            log.error("Failed to index %s: %s", f.name, e)
    return results


def answer_question(question: str) -> AnswerResult:
    settings = get_settings()
    question = (question or "").strip()
    if not question:
        raise ValueError("Question is empty.")

    embedder = get_embedder()
    store = get_vector_store()

    t0 = time.perf_counter()
    q_vec = embedder.embed_one(question)
    retrieved = store.query(q_vec, top_k=settings.top_k)
    retrieval_ms = int((time.perf_counter() - t0) * 1000)
    log.info("Retrieved %d chunks in %dms", len(retrieved), retrieval_ms)

    relevant = [c for c in retrieved if c.score >= MIN_SCORE]
    if not relevant:
        return AnswerResult(
            answer=NO_ANSWER, citations=[], retrieval_ms=retrieval_ms, generation_ms=0
        )

    prompt = build_rag_prompt(question, relevant)
    t1 = time.perf_counter()
    try:
        answer = generate_answer(prompt)
    except GeminiError as e:
        log.error("Gemini failure: %s", e)
        raise
    generation_ms = int((time.perf_counter() - t1) * 1000)
    log.info("Generated answer in %dms", generation_ms)

    answer = _clean_answer(answer)

    if _is_no_answer(answer):
        return AnswerResult(
            answer=NO_ANSWER,
            citations=[],
            retrieval_ms=retrieval_ms,
            generation_ms=generation_ms,
        )

    result = AnswerResult(
        answer=answer,
        citations=[_to_citation(c) for c in relevant],
        retrieval_ms=retrieval_ms,
        generation_ms=generation_ms,
    )
    log.info(
        "Chat completed: retrieve=%dms generate=%dms citations=%d",
        retrieval_ms,
        generation_ms,
        len(result.citations),
    )
    return result


def _clean_answer(text: str) -> str:
    """Strip all source-citation markup the LLM may have emitted."""
    cleaned = _RE_BRACKET_SOURCE.sub(" ", text)
    cleaned = _RE_PAREN_SOURCE.sub(" ", cleaned)
    cleaned = _RE_META_FRAGMENT.sub(" ", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def _is_no_answer(text: str) -> bool:
    t = text.strip().lower().rstrip(".")
    return t == NO_ANSWER.lower().rstrip(".")


def _to_citation(c: RetrievedChunk) -> Citation:
    m = c.metadata or {}
    return Citation(
        document_name=m.get("document_name", "unknown"),
        sheet_name=m.get("sheet_name"),
        paragraph_number=m.get("paragraph_number"),
        score=round(c.score, 4),
    )


def _sanitize_meta(meta: dict) -> dict:
    """Chroma metadata values must be str/int/float/bool."""
    out: dict = {}
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, (str, int, float, bool)):
            out[k] = v
        else:
            out[k] = str(v)
    return out
