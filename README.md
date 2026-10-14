# Documind - RAG Web Application

Documind is a Retrieval-Augmented Generation (RAG) web application that enables users to upload PDF or Markdown documents and ask context-aware questions about their content. The system uses the Google Gemini API for text embeddings (`gemini-embedding-001`) and conversational response generation.

---

## Project Architecture & Partitioning

The project is structured with a strict separation of concerns, partitioned into two independent codebases:

```
RagWeb/
├── Backend/                 # Python FastAPI Backend (RAG Pipeline & Auth)
│   ├── rag/                 # RAG pipeline modules (loader, chunker, embeddings, etc.)
│   ├── main.py              # Web API endpoints
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Template for server-side secrets
└── Frontend/                # Next.js Frontend (React UI)
    ├── src/                 # Application codebase (pages, components, styles)
    ├── next.config.mjs      # Rewrite proxy settings to bridge services
    ├── package.json         # Javascript dependencies & scripts
    └── .env.local.example   # Template for client-side configurations
```

1. **Frontend (Next.js)**: Runs independently on port `5173`. Communicates with the backend exclusively via relative API routes `/api/*` mapped via Next.js proxy rewrites to keep client code clean and avoid CORS issues.
2. **Backend (FastAPI)**: Runs independently on port `8000`. Handles user session validation, JWT generation, database interactions (Supabase PostgreSQL), document ingestion, vector storage, and Gemini API calls.

---

## Document uploads and indexing

- The uploader accepts PDF and UTF-8 Markdown (`.md`) files up to **50 MiB**. This is the application-level limit; the hosting provider can impose a lower request-body limit.
- PDFs are indexed from extractable text. Scanned/image-only PDFs may not produce searchable text because the current ingestion pipeline does not perform OCR.
- Extracted text is split into chunks of 2,000 characters with 200 characters of overlap. Gemini generates 768-dimensional embeddings in batches of up to 64 chunks, which are then stored in PostgreSQL/pgvector.
- Gemini quotas are shared by the API project and can still limit indexing. The backend retries short transient rate limits; when Gemini supplies a longer retry delay, the upload fails with that wait guidance rather than keeping the HTTP request open. Failed indexing is cleaned up; upload the document again after the quota window resets.
- The repository's optional Vercel Python deployment (`Backend/vercel.json`) is subject to Vercel Functions' **4.5 MB request-body limit**, below the app's 50 MiB limit. The frontend rewrite defaults to the Render backend URL below; confirm the actual deployment host before relying on the 50 MiB limit.

In chat, assistant messages are streamed. Enable **Show retrieved chunks** in Settings to inspect the excerpts used for an answer; when enabled, excerpts are saved with the assistant message and shown again in chat history.

---

## 🚀 Getting Started

### 1. Backend Setup & Run

Navigate to the `Backend/` directory and configure the environment:

```bash
cd Backend

# 1. Create a Python virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Setup Environment Variables
# Copy the template and adjust values:
cp .env.example .env

# 4. Start the FastAPI development server
python main.py
```

The API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 2. Frontend Setup & Run

Navigate to the `Frontend/` directory and configure the environment:

```bash
cd Frontend

# 1. Install packages
npm install

# 2. Setup Environment Variables
# Copy the template and adjust values:
cp .env.local.example .env.local

# 3. Start the Next.js development server
npm run dev
```

The user interface will be accessible at [http://localhost:5173](http://localhost:5173).

---

## 🛠️ Port & API Proxying

- The frontend utilizes the Next.js `rewrites` configuration (`Frontend/next.config.mjs`) to proxy all requests from the client at `/api/:path*` directly to the backend.
- By default, it proxies to `https://documind-mentors.onrender.com/`. You can configure a custom backend location by setting `BACKEND_API_URL` in the frontend's `.env.local` file:
  ```env
  BACKEND_API_URL=https://documind-mentors.onrender.com/
  ```
