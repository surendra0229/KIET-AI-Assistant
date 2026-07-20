# KIET AI Assistant

An AI-powered **Retrieval-Augmented Generation (RAG)** chatbot that answers questions **only from uploaded college documents**. The application uses semantic search and Google Gemini to generate accurate, context-aware responses with source citations.

---

# Features

* AI-powered document question answering
* RAG (Retrieval-Augmented Generation)
* PDF, DOCX, XLSX, and TXT document support
* Semantic search using ChromaDB
* Google Gemini integration
* JWT-based authentication
* Admin document management
* Chat history
* Dashboard and analytics
* Responsive user interface

---

# Architecture

```text
                 User
                   │
                   ▼
        React 19 + Vite Frontend
                   │
             REST API (HTTP)
                   │
                   ▼
          FastAPI Backend Server
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
  MongoDB      ChromaDB     Gemini API
 (Metadata)   (Embeddings)     (LLM)
      │            │
      └───────┬────┘
              ▼
         RAG Pipeline
              │
              ▼
     Grounded AI Response
```

---

# Technology Stack

## Frontend

* React 19
* Vite
* TypeScript
* TanStack Router
* Tailwind CSS v4
* ShadCN UI
* Axios

## Backend

* Python 3.11
* FastAPI
* Uvicorn
* Pydantic
* JWT Authentication

## AI & Database

* Google Gemini
* Sentence Transformers
* ChromaDB
* MongoDB

---

# Project Structure

```text
.
├── src/
│   ├── routes/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   └── styles.css
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── middleware/
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── .env.example
└── README.md
```

---

# RAG Workflow

```text
Upload Document
      │
      ▼
Extract Text
      │
      ▼
Split into Chunks
      │
      ▼
Generate Embeddings
      │
      ▼
Store in ChromaDB
      │
      ▼
User Question
      │
      ▼
Similarity Search
      │
      ▼
Retrieve Relevant Chunks
      │
      ▼
Build Prompt
      │
      ▼
Google Gemini
      │
      ▼
Answer with Citations
```

---

# Environment Variables

## Backend

```env
GEMINI_API_KEY=
GEMINI_MODEL=
MONGODB_URI=
JWT_SECRET=
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
EMBEDDING_MODEL=
```

## Frontend

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

# Installation

## Frontend

```bash
npm install
cp .env.example .env
npm run dev
```

Runs at:

```
http://localhost:8080
```

## Backend

```bash
cd backend

python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env

uvicorn app.main:app --reload --port 8000
```

API Documentation:

```
http://localhost:8000/docs
```

---

# API Endpoints

| Method | Endpoint     | Description             |
| ------ | ------------ | ----------------------- |
| GET    | `/health`    | Health check            |
| POST   | `/login`     | Admin login             |
| POST   | `/upload`    | Upload documents        |
| POST   | `/chat`      | Ask questions           |
| GET    | `/documents` | List uploaded documents |
| GET    | `/dashboard` | Dashboard statistics    |
| GET    | `/settings`  | Application settings    |

---

# Project Flow

```text
Admin Login
      │
      ▼
Upload College Documents
      │
      ▼
Document Processing
      │
      ▼
Embedding Generation
      │
      ▼
Store in ChromaDB
      │
      ▼
User Asks Question
      │
      ▼
Retrieve Relevant Content
      │
      ▼
Generate Response using Gemini
      │
      ▼
Display Answer with Source Citations
```

---

## Conclusion

KIET AI Assistant is a Retrieval-Augmented Generation (RAG) application designed to provide accurate, context-aware answers exclusively from uploaded college documents. By combining **FastAPI**, **React**, **Google Gemini**, **ChromaDB**, and **MongoDB**, the system delivers secure document management, semantic search, and citation-backed AI responses through a modern and scalable architecture. This approach minimizes hallucinations and ensures that users receive reliable information directly from the institution's knowledge base.
