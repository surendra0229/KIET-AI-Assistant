"""Prompt templates for grounded RAG generation."""
from __future__ import annotations

from app.services.vectordb.store import RetrievedChunk

NO_ANSWER = "I couldn't find this information in the uploaded college documents."


def _format_source_tag(meta: dict) -> str:
    doc = meta.get("document_name", "unknown")
    sheet = meta.get("sheet_name")
    para = meta.get("paragraph_number")
    parts = [f"document={doc}"]
    if sheet:
        parts.append(f"sheet={sheet}")
    if para is not None:
        parts.append(f"paragraph={para}")
    return ", ".join(parts)


def build_rag_prompt(question: str, contexts: list[RetrievedChunk]) -> str:
    context_blocks = []
    for i, c in enumerate(contexts, start=1):
        tag = _format_source_tag(c.metadata)
        context_blocks.append(f"[Source {i} | {tag}]\n{c.text}")
    context_str = "\n\n".join(context_blocks) if context_blocks else "(no context available)"

    return f"""You are a college information assistant. Answer STRICTLY using the provided context from official college documents.

Context:
{context_str}

Question:
{question}

Instructions:
- Answer ONLY using facts present in the Context above.
- Do NOT use outside knowledge, assumptions, or general training data.
- If the Context does not contain the answer, reply with EXACTLY this sentence and nothing else:
  {NO_ANSWER}
- Be concise, factual, and helpful.
- Write your answer as clean, natural language ONLY.
- NEVER include source references, citations, or tags of any kind inside your answer.
- Do NOT write anything like "(Source 1 | document=...)", "[Source 1]", "(Source: file.pdf)", or "document=..." in your answer.
- Citations are shown to the user separately — your answer text must contain ZERO citation markup.
- Do not fabricate document names, numbers, dates, or policies.

Answer:"""

