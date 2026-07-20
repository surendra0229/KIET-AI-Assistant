"""Recursive character-based chunker.

Mirrors LangChain's RecursiveCharacterTextSplitter but kept dependency-free
so the backend doesn't drag the full LangChain runtime.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.services.loaders.base import LoadedChunk


DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]


@dataclass
class Chunk:
    id: str
    text: str
    metadata: dict


def _split(text: str, size: int, overlap: int, seps: list[str]) -> list[str]:
    if len(text) <= size:
        return [text] if text.strip() else []

    sep = next((s for s in seps if s and s in text), "")
    if not sep:
        # Hard split
        out: list[str] = []
        start = 0
        while start < len(text):
            end = min(start + size, len(text))
            out.append(text[start:end])
            if end == len(text):
                break
            start = end - overlap
        return out

    parts = text.split(sep)
    merged: list[str] = []
    buf = ""
    for part in parts:
        candidate = (buf + sep + part) if buf else part
        if len(candidate) <= size:
            buf = candidate
            continue
        if buf:
            merged.append(buf)
        if len(part) > size:
            merged.extend(_split(part, size, overlap, seps[seps.index(sep) + 1 :]))
            buf = ""
        else:
            buf = part
    if buf:
        merged.append(buf)

    # Apply overlap between adjacent chunks
    if overlap <= 0 or len(merged) < 2:
        return merged
    with_overlap: list[str] = [merged[0]]
    for i in range(1, len(merged)):
        prev_tail = merged[i - 1][-overlap:]
        with_overlap.append(prev_tail + merged[i])
    return with_overlap


def chunk_loaded(
    loaded: Iterable[LoadedChunk],
    *,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[Chunk]:
    """Chunk pre-loaded blocks. Small blocks pass through; long ones are split."""
    out: list[Chunk] = []
    counter = 0
    for block in loaded:
        pieces = _split(block.text, chunk_size, chunk_overlap, DEFAULT_SEPARATORS)
        for piece in pieces:
            piece = piece.strip()
            if not piece:
                continue
            meta = dict(block.metadata)
            doc = meta.get("document_name", "unknown")
            chunk_id = f"{doc}::c{counter}"
            meta["chunk_id"] = chunk_id
            out.append(Chunk(id=chunk_id, text=piece, metadata=meta))
            counter += 1
    return out
