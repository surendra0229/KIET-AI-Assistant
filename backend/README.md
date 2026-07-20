# College AI Assistant — Backend

FastAPI backend implementing a full **Retrieval-Augmented Generation (RAG)** pipeline
grounded strictly in uploaded college documents (DOCX + XLSX). The assistant will
**never** answer from general knowledge — if the corpus doesn't contain the answer,
it responds with:

> I couldn't find this information in the uploaded college documents.

## Stack

| Layer        | Tech                                          |
| ------------ | --------------------------------------------- |
| API          | FastAPI                                       |
| LLM          | Google Gemini (`gemini-1.5-flash` by default) |
| Embeddings   | `sentence-transformers/all-MiniLM-L6-v2`      |
| Vector store | ChromaDB (persistent)                         |
| Chunking     | Recursive character splitter (1000 / 200)     |
| Loaders      | `python-docx`, `openpyxl`                     |

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then paste your GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs

## Endpoints

| Method | Path                | Purpose                                       |
| ------ | ------------------- | --------------------------------------------- |
| GET    | `/health`           | Liveness probe                                |
| GET    | `/status`           | Corpus + config snapshot                      |
| GET    | `/dashboard`        | Aggregates for the frontend dashboard         |
| POST   | `/upload`           | Upload one or more DOCX / XLSX (auto-indexes) |
| POST   | `/index`            | Re-index every file in `data/documents/`      |
| GET    | `/documents`        | List indexed documents + chunk counts         |
| DELETE | `/documents/{name}` | Remove a document from disk + vector DB       |
| POST   | `/chat`             | Ask a grounded question                       |
| GET    | `/settings`         | Runtime configuration                         |

### Chat response shape

```json
{
  "reply": "Minimum attendance required is 75%.",
  "citations": [
    {
      "document_name": "Attendance.xlsx",
      "sheet_name": "Rules",
      "paragraph_number": 3,
      "score": 0.82
    }
  ],
  "retrieval_ms": 42,
  "generation_ms": 890,
  "query": "What is the minimum attendance?"
}
```

## Pipeline

1. **Load** — `python-docx` / `openpyxl` extract paragraphs, tables, and rows;
   empty rows and empty sheets are dropped, whitespace normalized.
2. **Chunk** — recursive character splitter (size 1000 / overlap 200) preserves
   metadata: `document_name`, `chunk_id`, `sheet_name`, `paragraph_number`.
3. **Embed** — sentence-transformer encodes each chunk (normalized vectors,
   cosine similarity).
4. **Store** — upserted into a persistent ChromaDB collection.
5. **Retrieve** — top-5 chunks; anything below `MIN_SCORE=0.25` is treated as
   "no relevant match" and short-circuits to the fallback response.
6. **Prompt** — grounded template that forbids outside knowledge and requires
   the exact fallback sentence when the context is insufficient.
7. **Generate** — Gemini returns the answer, which is returned with citations.

## Layout

```
backend/
├── app/
│   ├── api/            # FastAPI routers
│   ├── core/           # config + logging
│   ├── schemas/        # Pydantic request/response models
│   └── services/
│       ├── loaders/    # DOCX / XLSX text extraction
│       ├── chunker.py  # recursive splitter
│       ├── embeddings/ # sentence-transformer wrapper
│       ├── vectordb/   # ChromaDB persistence
│       ├── prompts/    # grounded RAG prompt
│       ├── llm/        # Gemini client
│       └── rag/        # end-to-end pipeline
└── data/               # documents/ + chroma/ (created on first run)
```

## Error handling

- Unsupported extension → `400` in the upload response item.
- Empty / corrupted DOCX or XLSX → `failed` upload status with a message.
- Missing `GEMINI_API_KEY` → `/chat` returns `503`.
- Empty question → `/chat` returns `400`.
- Vector DB errors are logged and surfaced as `500`.

## Logging

Structured console logging covers uploads, chunking, embedding batches,
retrieval and generation latency, and every error path.
