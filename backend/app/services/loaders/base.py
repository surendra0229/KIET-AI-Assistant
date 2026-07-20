"""Document loader dispatcher.

Each loader returns a list of `LoadedChunk` — a small block of cleaned text
with structural metadata (sheet / paragraph number). These blocks are later
merged/split by the chunker into embedding-sized windows.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class LoadedChunk:
    text: str
    metadata: dict = field(default_factory=dict)


_WS = re.compile(r"[ \t]+")
_NL = re.compile(r"\n{3,}")


def clean_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = _WS.sub(" ", text)
    text = _NL.sub("\n\n", text)
    return text.strip()


SUPPORTED_EXTENSIONS = {".docx", ".xlsx", ".xlsm", ".pdf", ".txt"}


def load_document(path: str | Path) -> list[LoadedChunk]:
    p = Path(path)
    ext = p.suffix.lower()
    from .docx_loader import load_docx
    from .xlsx_loader import load_xlsx
    from .pdf_loader import load_pdf
    from .txt_loader import load_txt

    if ext == ".docx":
        return load_docx(p)
    if ext in {".xlsx", ".xlsm"}:
        return load_xlsx(p)
    if ext == ".pdf":
        return load_pdf(p)
    if ext == ".txt":
        return load_txt(p)
    raise ValueError(f"Unsupported document type: {ext}")
