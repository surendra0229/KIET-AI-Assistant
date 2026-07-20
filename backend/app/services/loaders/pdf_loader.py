from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from .base import LoadedChunk, clean_text


def load_pdf(path: Path) -> list[LoadedChunk]:
    try:
        reader = PdfReader(str(path))
    except (PdfReadError, OSError) as e:
        raise ValueError(f"Corrupted or invalid PDF: {path.name}") from e

    chunks: list[LoadedChunk] = []
    para_no = 0
    for page_no, page in enumerate(reader.pages, start=1):
        try:
            raw = page.extract_text() or ""
        except Exception:  # noqa: BLE001
            raw = ""
        for para in raw.split("\n\n"):
            text = clean_text(para)
            if not text:
                continue
            para_no += 1
            chunks.append(
                LoadedChunk(
                    text=text,
                    metadata={
                        "document_name": path.name,
                        "page_number": page_no,
                        "paragraph_number": para_no,
                        "source_type": "pdf",
                    },
                )
            )
    return chunks
