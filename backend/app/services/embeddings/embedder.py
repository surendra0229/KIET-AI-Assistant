"""Sentence-transformer embedder singleton.

Model loads lazily on first use — startup stays fast, and tests can monkeypatch.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Sequence

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class Embedder:
    def __init__(self, model_name: str) -> None:
        # pyrefly: ignore [missing-import]
        from sentence_transformers import SentenceTransformer

        log.info("Loading embedding model: %s", model_name)
        self.model_name = model_name
        self._model = SentenceTransformer(model_name)
        self.dim = self._model.get_embedding_dimension()

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._model.encode(
            list(texts),
            batch_size=32,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return vectors.tolist()

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


@lru_cache
def get_embedder() -> Embedder:
    settings = get_settings()
    return Embedder(settings.embedding_model)
