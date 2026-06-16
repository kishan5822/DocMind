# DocMind

A free, multi-user **Retrieval-Augmented Generation (RAG)** web app. Upload mixed
documents, then ask questions and get answers grounded strictly in *your* files.

Everything runs on free, open-source tooling. The **only** external paid-style
dependency is the LLM inference API (Groq free tier), and the API key is used in
exactly one place: generating the final chat answer. Parsing, chunking,
embedding, retrieval, and reranking all run locally with zero API calls.

---

## Features

- Upload up to **10 files** per batch (≤10 MB each, ≤100 MB total), mixed types.
- Supported: PDF, DOCX, PPTX, XLSX, CSV, JSON, TXT, MD, HTML, PNG/JPG (OCR).
- **Hybrid retrieval**: dense vectors + BM25 keyword, fused with Reciprocal Rank
  Fusion, reranked by a local cross-encoder.
- **Grounded answers**: the model answers only from your documents and declines
  when the context is insufficient (no hallucination).
- **Per-session isolation**: each browser session has its own documents and chat
  memory; one user can never retrieve another's chunks.
- **Ephemeral**: documents and memory expire and are cleaned up; nothing persists.

---

## Architecture

```
Streamlit UI (app.py)
        │
        ▼
docmind/ package — single-responsibility modules
  config.py        env + tunable settings (reads GROQ_API_KEY)
  validation.py    Stage 1: count/size/content-type checks
  parsing.py       Stage 2: PyMuPDF / python-docx / python-pptx / pandas / bs4 / OCR
  chunking.py      Stage 3: recursive 512-token splitter + metadata prefix
  embeddings.py    Stage 4: BAAI/bge-base-en-v1.5 (local, CPU)
  vector_store.py  Stage 5: ChromaDB, one isolated collection per session
  keyword_index.py BM25 (rank_bm25, in-memory)
  retrieval.py     Stage 6: dense + BM25 + RRF + FlashRank rerank
  prompt.py        grounding prompt builder
  llm.py           Stage 7: Groq client — the ONLY place the API key is used
  formatting.py    Stage 12: clean markdown output
  session.py       sessions, memory, ingestion orchestration, cleanup
```

### Technology choices (and deviations from the spec, flagged)

- **PDF parsing**: PyMuPDF is the default (fast, light). **Docling** is opt-in
  via `ENABLE_DOCLING=true` for complex/scanned PDFs — it is heavy (CPU PyTorch +
  ~2 GB models) and risky on free-tier RAM, so it is not the default. Install its
  extra deps with `pip install -r requirements-docling.txt`.
- **ChromaDB 1.5.x** (not 0.5.x): the 1.x line ships prebuilt Rust-binding wheels
  on Windows/Python 3.12, avoiding a from-source `chroma-hnswlib` build that needs
  the MSVC C++ toolchain. The API used here is stable across the change.
- **LlamaIndex**: the pipeline is implemented explicitly (direct ChromaDB /
  sentence-transformers / rank_bm25 / FlashRank) rather than through LlamaIndex
  abstractions, for debuggability and a smaller footprint on free hosting.

---

## Requirements

- **Python 3.12** (the ML stack does not yet support 3.13/3.14).
- **Tesseract OCR** binary, only if you want image OCR. Windows:
  `winget install UB-Mannheim.TesseractOCR`. Set `TESSERACT_CMD` if not on PATH.

---

## Setup (local)

```bash
# 1. Create a 3.12 virtual environment
py -3.12 -m venv .venv
.venv\Scripts\activate           # Windows
# source .venv/bin/activate      # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt
# optional, heavy: pip install -r requirements-docling.txt

# 3. Configure secrets
copy .env.example .env           # Windows  (cp on macOS/Linux)
# edit .env and set GROQ_API_KEY=...   (get one free at https://console.groq.com/keys)

# 4. Run
streamlit run app.py
```

First run downloads the embedding and reranker models from Hugging Face (one
time, cached locally).

---

## Environment variables

`GROQ_API_KEY` is **required**. All others are optional with sensible defaults —
see [.env.example](.env.example) for the full list with comments (chunk size,
overlap, retrieval top-k values, upload limits, default model, session TTL,
data directory, Tesseract path, Docling toggle).

The key is read only from the environment, never hardcoded, never logged
(a redaction filter strips it from logs), and never sent to the frontend.

---

## Testing

Verification mirrors the build stages. Run from the project root with the venv
active:

```bash
python -m tests.test_validation     # Stage 1: file validation
python -m tests.test_pipeline        # Stages 2-6, 10, 12 (no key needed)
python -m tests.test_api_key_audit   # Stage 8: key-usage audit
python -m tests.test_generation      # Stages 7 & 9 (needs GROQ_API_KEY)
```

---

## Deploy to Hugging Face Spaces

1. Create a new **Streamlit** Space (free tier).
2. Push this repo (or upload the files). Do **not** commit `.env`.
3. In the Space **Settings → Variables and secrets**, add a secret
   `GROQ_API_KEY` with your key.
4. Ensure `requirements.txt` is at the repo root (it is). The Space installs it
   automatically. Keep `ENABLE_DOCLING=false` on free tiers.
5. The Space launches `app.py` automatically.

Free hosting has limited RAM and ephemeral disk — the design accounts for this:
local CPU models, in-memory BM25, and automatic session expiry/cleanup.

---

## Security notes

- One Groq key, one egress point (`llm.py`), verified by an audit test.
- Per-session ChromaDB collections enforce data isolation at the data layer.
- Uploaded files, embeddings, indexes, and memory are cleaned up on session end
  or expiry; nothing persists permanently.
- File uploads are validated by real content (magic bytes), not extension alone.
