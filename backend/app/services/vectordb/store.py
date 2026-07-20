"""ChromaDB persistence layer."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


@dataclass
class RetrievedChunk:
    text: str
    metadata: dict
    score: float


class VectorStore:
    def __init__(self, persist_dir: str, collection_name: str) -> None:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        self._client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
        )
        self.collection_name = collection_name
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        log.info("Chroma collection ready: %s (%d items)", collection_name, self._collection.count())

    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict[str, Any]],
    ) -> None:
        if not ids:
            return
        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

    def delete_by_document(self, document_name: str) -> int:
        try:
            existing = self._collection.get(where={"document_name": document_name})
            ids = existing.get("ids", []) or []
            if ids:
                self._collection.delete(ids=ids)
            return len(ids)
        except Exception as e:  # noqa: BLE001
            log.warning("delete_by_document failed for %s: %s", document_name, e)
            return 0

    def query(self, embedding: list[float], top_k: int = 5) -> list[RetrievedChunk]:
        if self._collection.count() == 0:
            return []
        res = self._collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        out: list[RetrievedChunk] = []
        for text, meta, dist in zip(docs, metas, dists):
            out.append(
                RetrievedChunk(
                    text=text,
                    metadata=dict(meta or {}),
                    score=float(1.0 - dist),
                )
            )
        return out

    def count(self) -> int:
        return self._collection.count()

    def list_documents(self) -> list[dict[str, Any]]:
        try:
            data = self._collection.get(include=["metadatas"])
        except Exception:  # noqa: BLE001
            return []
        metas = data.get("metadatas") or []
        by_doc: dict[str, int] = {}
        for m in metas:
            name = (m or {}).get("document_name", "unknown")
            by_doc[name] = by_doc.get(name, 0) + 1
        return [{"name": n, "chunks": c} for n, c in sorted(by_doc.items())]


@lru_cache
def get_vector_store() -> VectorStore:
    s = get_settings()
    return VectorStore(s.chroma_persist_dir, s.chroma_collection)
