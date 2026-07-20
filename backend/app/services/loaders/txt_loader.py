from __future__ import annotations

from pathlib import Path
from .base import LoadedChunk, clean_text


def load_txt(path: Path) -> list[LoadedChunk]:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except OSError as e:
        raise ValueError(f"Could not read text file: {path.name}") from e

    chunks: list[LoadedChunk] = []
    para_no = 0
    paragraphs = content.split("\n\n")
    for para in paragraphs:
        text = clean_text(para)
        if not text:
            continue
        para_no += 1
        chunks.append(
            LoadedChunk(
                text=text,
                metadata={
                    "document_name": path.name,
                    "paragraph_number": para_no,
                    "source_type": "txt",
                },
            )
        )
    return chunks
