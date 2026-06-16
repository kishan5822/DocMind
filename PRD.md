# DocMind — Product Requirements Document

## 1. Overview

DocMind is a free, multi-user Retrieval-Augmented Generation (RAG) web application. Users upload documents of mixed file types, then ask questions in a chat interface and receive accurate, grounded answers generated from the contents of those documents.

The entire system runs on free and open-source tooling. The only external paid-style dependency is the LLM inference API (Groq free tier), and the API key for it is used in exactly one place: generating the final chat response. No other component in the system uses an API key.

This document is the build specification. Follow it exactly. Build incrementally and verify each stage works before moving to the next. Do not write the whole system in one pass.

---

## 2. Core principles (apply to every part of the build)

1. Build in small, testable stages. After each module is written, run it and confirm it works before continuing. Never proceed on untested code.
2. Validate inputs everywhere. Every function that takes user input or file data must validate it and fail gracefully with a clear message, never a raw crash.
3. Security first. The Groq API key is read only from an environment variable, never hardcoded, never logged, never sent to the frontend. User-uploaded data from one user must never be retrievable by another user.
4. The API key is used ONLY for final response generation. Embedding, parsing, chunking, retrieval, and reranking must all run locally with open-source models and zero API calls.
5. Clean output formatting. The final answer shown to the user must be properly rendered text. If something is bold, it must render as real bold, not literal asterisk characters. No stray markdown symbols (`**`, `##`, etc.) should ever appear as raw text in the user-facing answer.
6. Every error must be caught and shown as a friendly message in the UI, with the full traceback logged server-side for debugging.

---

## 3. What the product does (user perspective)

1. A user opens the app and sees a chat interface with a file upload area and a model selector.
2. The user uploads up to 10 files at once (mixed types allowed), each up to 10 MB, 100 MB total per batch.
3. The system ingests those files: parses, chunks, embeds, and stores them — showing clear progress and a confirmation when ready.
4. The user types a question. The system retrieves the most relevant chunks from that user's documents and generates an answer grounded in them.
5. The chat remembers earlier turns within the same chat session, so follow-up questions work naturally.
6. Starting a new chat gives a fresh, separate memory and (per the session model below) a fresh document context.
7. Uploaded documents and chat memory expire — they are not stored permanently.

---

## 4. Functional requirements

### 4.1 File upload

- Accept up to 10 files per upload batch.
- Each file maximum 10 MB. Total batch maximum 100 MB.
- Mixed file types may be uploaded together in the same batch.
- Supported types: PDF, DOCX, PPTX, XLSX, CSV, JSON, TXT, MD, HTML, and common image formats (PNG, JPG) via OCR.
- Reject unsupported types, oversized files, or batches over the limit with a clear, specific message stating which file failed and why.
- Validate the actual file content/type, not just the file extension.

### 4.2 Document ingestion pipeline

Order of operations:

1. Parse each file to clean text using the right parser for its type (see Section 6).
2. Chunk the text using recursive splitting at 512 tokens with 15% overlap.
3. Prepend lightweight metadata (source filename and section/heading when available) to each chunk before embedding. This metadata prefix is required — it measurably improves retrieval accuracy.
4. Generate embeddings locally using the embedding model in Section 6. No API call.
5. Store chunks, embeddings, and metadata in ChromaDB, isolated to the current user/session (see Section 5).
6. Build a BM25 keyword index over the same chunks for hybrid retrieval.

The pipeline must report progress and handle a single bad file in a batch without failing the whole batch — skip the bad file, report it, continue with the rest.

### 4.3 Retrieval

For each user question:

1. Run dense vector search in ChromaDB (top 25) scoped to the current user/session.
2. Run BM25 keyword search (top 25) over the same scope.
3. Fuse both result sets using Reciprocal Rank Fusion (RRF) into up to 50 unique candidates.
4. Rerank the candidates with the local cross-encoder reranker (Section 6) and keep the top 5.
5. Pass only those top 5 chunks as context to the LLM.

All of steps 1 to 4 run locally with no API key.

### 4.4 Response generation (the ONLY place the API key is used)

1. Build a prompt containing: a system instruction, the retrieved top-5 context chunks, the conversation history for this chat session, and the user's current question.
2. Call the Groq API with the selected model to generate the answer.
3. Stream the answer back to the UI.
4. The answer must be grounded in the provided context. If the context does not contain the answer, the model should say it does not have enough information rather than inventing one.
5. Citations are NOT required in the answer.

### 4.5 Chat memory

- Each chat session has its own independent memory.
- Within a session, prior user questions and assistant answers are included in the prompt so follow-ups work.
- Starting a new chat creates a new session with empty memory and its own document scope.
- Memory is held only for the life of the session and expires with it. No permanent storage.

### 4.6 Model selector

- The UI exposes a model selector.
- Default model: Llama 3.1 8B (fastest free Groq model).
- The selector may list other free Groq models as options, but 8B is the default selection.

### 4.7 Expiry / cleanup

- Uploaded documents and their embeddings are temporary and must expire.
- When a session ends or expires, its ChromaDB collection, BM25 index, uploaded files, and chat memory must be cleaned up so nothing persists permanently and no storage leaks accumulate.

---

## 5. Multi-user isolation (critical, security-sensitive)

- The system is multi-user. Multiple people use it at the same time.
- Each user/session gets a unique identifier.
- Every ChromaDB collection, BM25 index, and uploaded-file area is keyed to that identifier.
- Retrieval for a given question must be scoped strictly to that user's/session's own data. It must be impossible for one user's query to retrieve another user's document chunks.
- This isolation must be enforced at the data-access layer, not just in the UI, and must be explicitly verified by a test (see Section 9).

---

## 6. Finalized technology stack (do not substitute without flagging)

### Parsing
- PDF (complex layout, tables, multi-column, scanned): Docling. Install the CPU-only PyTorch variant for free hosting. Docling downloads its models on first run — handle that first-run download gracefully.
- PDF (simple, fast text-only): PyMuPDF.
- DOCX / PPTX: Docling (or python-docx / python-pptx as a fallback).
- XLSX / CSV / JSON: pandas.
- HTML / MD: BeautifulSoup4.
- Images (OCR): pytesseract.
- read here - https://github.com/docling-project/docling 

### Chunking
- Recursive character/token splitter, 512 tokens, 15% overlap, with required metadata prefix per chunk.

### Embedding (local, no API key)
- `BAAI/bge-base-en-v1.5` via the sentence-transformers library, running locally on CPU.

### Vector database
- ChromaDB in persistent mode, one isolated collection per user/session.

### Keyword search
- `rank_bm25` (pure Python, in-memory).

### Fusion
- Reciprocal Rank Fusion, implemented directly (small, no extra dependency needed).

### Reranking (local, no API key)
- FlashRank with the `ms-marco-MiniLM-L-12-v2` cross-encoder model. Runs on CPU, fast.

### Orchestration
- LlamaIndex to tie ingestion and retrieval together (use its components where they help; keep the pipeline explicit and debuggable).

### LLM (the only API key in the system)
- Groq API. Default model: Llama 3.1 8B. Key read from environment variable only.

### Frontend
- Streamlit. Functional first; visual polish comes later. Build it clean and simple.

### Backend
- A clean Python backend. Streamlit can host the app logic directly, or a separate FastAPI layer can sit behind it — choose the simpler reliable option and keep the ingestion/retrieval/generation logic in well-separated modules.

### Hosting (target environment)
- Frontend on Hugging Face Spaces (user has an account).
- Groq for LLM (user has an account).
- Keep everything deployable on free tiers. Be mindful that free hosting has limited RAM and ephemeral disk — the design already accounts for this.

---

## 7. Configuration and secrets

- All secrets and tunable settings come from environment variables.
- Required environment variable: the Groq API key.
- Provide an `.env.example` file listing every required variable with placeholder values and a short comment for each. Never commit a real `.env`.
- Tunable settings to expose via config (with sensible defaults): chunk size, chunk overlap, top-k for dense search, top-k for BM25, number of fused candidates, number of reranked chunks passed to the LLM, max file size, max files per batch, default model.

---

## 8. Project structure and code quality

- Organize the code into clear, single-responsibility modules: configuration, file validation, parsing, chunking, embedding, vector store, keyword index, retrieval/fusion/reranking, prompt building, LLM client, session/memory management, and the Streamlit app.
- Each module should be independently testable.
- Include type hints and short docstrings on public functions.
- Provide a `requirements.txt` pinned to working versions.
- Provide a `README.md` explaining setup, required environment variables, how to run locally, and how to deploy to Hugging Face Spaces.
- No secrets, keys, or personal data in any committed file.

---

## 9. Verification and testing (do this at every stage — non-negotiable)

Build and verify in this order. Do not move to the next stage until the current one is confirmed working.

1. File validation: test that oversized files, too many files, and unsupported types are correctly rejected with clear messages, and valid mixed batches are accepted.
2. Parsing: test each supported file type parses to clean text. Confirm a complex multi-column PDF and a PDF with a table extract correctly.
3. Chunking: confirm chunks are the right size with correct overlap and that the metadata prefix is present on each chunk.
4. Embedding: confirm embeddings are produced locally, have the expected dimensions, and that no network/API call is made during embedding.
5. Vector store + isolation: confirm chunks are stored under the correct user/session key, and explicitly test that a query from user A cannot retrieve user B's chunks.
6. Hybrid retrieval: confirm dense + BM25 + RRF + rerank returns sensible, relevant top-5 chunks for a known question.
7. Generation: confirm the Groq call works, the answer is grounded in the retrieved context, and the key is read only from the environment. Confirm that when the context lacks the answer, the model declines rather than hallucinating.
8. API-key audit: explicitly verify, by code inspection and by running with network calls traced, that the API key is used in the generation step and nowhere else. This is a required check.
9. Memory: confirm follow-up questions in the same session use prior context, and that a new chat has fresh, separate memory.
10. Expiry/cleanup: confirm that ending/expiring a session removes its collection, index, files, and memory with no leftovers.
11. End-to-end: upload a mixed batch, ask several questions including a follow-up, switch to a new chat, and confirm everything behaves correctly.
12. Output formatting: confirm the final answer renders as clean, properly formatted text — real bold where bold is intended, and no raw markdown symbols (`**`, `##`, etc.) appearing as literal characters in the displayed answer.

For each stage, if a test fails, fix it before continuing. Report what was tested and the result at each stage.

---

## 10. Output formatting requirement (explicit)

The final response shown to the user must be clean and well formatted:

- Properly rendered text, not raw markup.
- If a word or phrase is meant to be bold, it must display as actual bold, never as literal asterisks around the word.
- No leftover markdown control characters visible in the output.
- Paragraphs and line breaks should render cleanly and readably.
- Verify this in the UI directly as part of stage 12 above.

---

## 11. Definition of done

The project is complete when:

1. A user can upload a mixed batch of up to 10 files (≤10 MB each, ≤100 MB total) of different types and have them ingested successfully, with bad files skipped and reported.
2. The user can ask questions and get accurate answers grounded only in their own uploaded documents.
3. Follow-up questions work within a chat session; new chats have separate memory and document scope.
4. Multiple users are strictly isolated from each other's data, verified by test.
5. The Groq API key is used only for final response generation, verified by audit, and never exposed to the frontend or logs.
6. Documents and memory expire and are cleaned up; nothing persists permanently.
7. Every stage in Section 9 has been tested and passes.
8. The final answers render as clean, properly formatted text with no raw markdown artifacts.
9. The app runs on the free-tier target environment (Hugging Face Spaces + Groq).
10. A README documents setup, environment variables, running, and deployment.


