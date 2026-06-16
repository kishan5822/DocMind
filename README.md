# DocMind

**Ask questions. Get answers grounded strictly in your own documents.**

DocMind is a local-first RAG (Retrieval-Augmented Generation) web app. Upload a mix of PDFs, Word docs, spreadsheets, images, and more — then chat with them. Every answer is sourced from your files. Nothing hallucinates. Nothing persists.

---

## Features

- **Multi-format ingestion** — PDF (text + scanned/OCR), DOCX, PPTX, XLSX, CSV, JSON, TXT, MD, HTML, PNG/JPG
- **Hybrid retrieval** — Dense vector search + BM25 keyword search, fused with Reciprocal Rank Fusion, reranked by a local cross-encoder
- **Grounded answers** — The LLM answers only from your documents. If the answer isn't there, it says so
- **Per-session isolation** — Each browser tab gets its own encrypted vector collection. One user can never retrieve another's data
- **Live model selector** — Dropdown fetches all active Groq models at startup; switch models mid-session
- **Ephemeral by design** — Sessions expire after inactivity. No data persists permanently
- **100% local ML** — Embedding, retrieval, and reranking run entirely on CPU. The Groq API is used only for the final chat response

---

## Architecture

```
Browser (Streamlit)
       │
       ▼
    app.py  ──────────────────────────────────────────────────────┐
       │                                                          │
       ▼                                                          │
  session.py  (orchestration, isolation, TTL cleanup)             │
       │                                                          │
   ┌───┴────────────────────────────────────────┐                 │
   │                                            │                 │
   ▼ INGEST PIPELINE                            ▼ QUERY PIPELINE  │
                                                                  │
  validation.py  ← Stage 1: size, type, magic bytes              │
  parsing.py     ← Stage 2: PyMuPDF / docx / pptx / OCR         │
  chunking.py    ← Stage 3: 512-token recursive splitter         │
  embeddings.py  ← Stage 4: BAAI/bge-base-en-v1.5 (local CPU)   │
  vector_store.py ← Stage 5: ChromaDB, one collection/session    │
                                                                  │
                    retrieval.py ← Stage 6: dense + BM25 + RRF   │
                                              + FlashRank rerank  │
                    prompt.py    ← Stage 7: context builder       │
                    llm.py       ← Stage 7: Groq API (key here)  ─┘
                    formatting.py ← Stage 12: clean markdown out
```

### Technology choices

| Component | Library | Why |
|-----------|---------|-----|
| UI | Streamlit 1.40 | Fast to build, session_state gives per-tab isolation |
| PDF | PyMuPDF 1.24 | Fast text extraction; falls back to Tesseract OCR for scanned pages |
| Embedding | BAAI/bge-base-en-v1.5 (sentence-transformers) | Strong retrieval quality, 768-dim, CPU-friendly |
| Vector DB | ChromaDB 1.5.x | Prebuilt Rust wheels on Windows/Python 3.12 — no compiler needed |
| Keyword search | rank-bm25 | Zero-dependency in-memory BM25Okapi |
| Reranker | ms-marco-MiniLM-L-12-v2 (FlashRank) | Cross-encoder quality, local, fast |
| LLM | Groq API (any active model) | Free tier, fast inference, live model list via API |
| Token counting | tiktoken cl100k_base | Accurate chunk sizing |

---

## Retrieval Pipeline (Deep Dive)

```
Query
  │
  ├─► Dense search     top-25 chunks (cosine similarity via ChromaDB)
  ├─► BM25 search      top-25 chunks (keyword match)
  │
  ▼
Reciprocal Rank Fusion   →  top-50 unique candidates
  │                         score = Σ 1 / (60 + rank)
  ▼
FlashRank cross-encoder  →  top-5 reranked chunks
  │                         (filtered: score < -3.0 discarded as irrelevant)
  ▼
Groq LLM                 →  streamed answer
```

Chunks that score below the reranker threshold are discarded — so greetings and off-topic questions automatically get no document context and the LLM responds naturally.

---

## Requirements

- **Python 3.12** — The ML stack (torch, sentence-transformers, chromadb) does not support 3.13/3.14 yet
- **Tesseract OCR** — Only needed for scanned PDFs and image uploads
  - Windows: `winget install UB-Mannheim.TesseractOCR`
  - macOS: `brew install tesseract`
  - Linux: `apt install tesseract-ocr`
- **A Groq API key** — Free at [console.groq.com/keys](https://console.groq.com/keys)

---

## Setup

```bash
# 1. Clone
git clone https://github.com/kishan5822/DocMind.git
cd DocMind

# 2. Create a Python 3.12 virtual environment
py -3.12 -m venv .venv          # Windows
python3.12 -m venv .venv        # macOS / Linux

# 3. Activate
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux

# 4. Install dependencies
pip install -r requirements.txt

# 5. Configure
copy .env.example .env          # Windows
cp .env.example .env            # macOS / Linux
# Edit .env — set GROQ_API_KEY=gsk_...

# 6. Run
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501). The first run downloads the embedding model and reranker from Hugging Face (~500 MB, cached locally).

---

## Environment Variables

`GROQ_API_KEY` is required. All others are optional with the defaults shown.

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | **Required.** Groq API key |
| `DEFAULT_MODEL` | `llama-3.1-8b-instant` | Default model in the selector |
| `EMBEDDING_MODEL` | `BAAI/bge-base-en-v1.5` | HuggingFace embedding model |
| `RERANKER_MODEL` | `ms-marco-MiniLM-L-12-v2` | FlashRank cross-encoder model |
| `CHUNK_SIZE_TOKENS` | `512` | Max tokens per chunk |
| `CHUNK_OVERLAP_RATIO` | `0.15` | Overlap between adjacent chunks |
| `DENSE_TOP_K` | `25` | Candidates from vector search |
| `BM25_TOP_K` | `25` | Candidates from keyword search |
| `FUSION_CANDIDATES` | `50` | RRF output size |
| `RERANK_TOP_K` | `5` | Final chunks passed to LLM |
| `MAX_FILE_MB` | `10` | Per-file upload limit |
| `MAX_BATCH_MB` | `100` | Total batch upload limit |
| `MAX_FILES_PER_BATCH` | `10` | Files per upload action |
| `SESSION_TTL_MINUTES` | `120` | Session idle timeout |
| `DATA_DIR` | `.docmind_data` | Storage root for ChromaDB and uploads |
| `TESSERACT_CMD` | _(auto)_ | Full path to tesseract binary if not on PATH |
| `ENABLE_DOCLING` | `false` | Enable Docling for complex scanned PDFs (heavy) |

See [.env.example](.env.example) for the full annotated list.

---

## Supported File Types

| Type | Extension(s) | Parser |
|------|-------------|--------|
| PDF | `.pdf` | PyMuPDF (text); Tesseract OCR (scanned pages) |
| Word | `.docx` | python-docx (paragraphs + tables) |
| PowerPoint | `.pptx` | python-pptx (per-slide) |
| Excel | `.xlsx` | pandas + openpyxl (per-sheet CSV) |
| CSV | `.csv` | pandas |
| JSON | `.json` | stdlib json (pretty-printed) |
| Text / Markdown | `.txt`, `.md` | UTF-8 decode |
| HTML | `.html`, `.htm` | BeautifulSoup + lxml |
| Images | `.png`, `.jpg`, `.jpeg` | Tesseract OCR |

---

## Testing

Tests mirror the build stages. Run from the project root with the venv active:

```bash
# Stage 1: file validation
python -m tests.test_validation

# Stages 2–6, 10, 12: full pipeline (no API key needed)
python -m tests.test_pipeline

# Stage 8: static API key containment audit
python -m tests.test_api_key_audit

# Stages 7 & 9: LLM generation + conversation memory (requires GROQ_API_KEY)
python -m tests.test_generation

# End-to-end: mixed batch ingest → ask → follow-up → new chat
python -m tests.test_e2e
```

---

## Deploy to Hugging Face Spaces

1. Create a new **Streamlit** Space (free tier)
2. Push this repo — do **not** include `.env`
3. In **Settings → Variables and secrets**, add `GROQ_API_KEY`
4. The Space auto-installs `requirements.txt` and launches `app.py`

> Keep `ENABLE_DOCLING=false` on free-tier Spaces — Docling's models exceed the RAM budget.

---

## Security

| Property | Implementation |
|----------|---------------|
| API key confinement | Read in `config.py`, used only in `llm.py`, redacted from logs in `logging_config.py` — verified by a static audit test |
| Data isolation | Each session gets its own ChromaDB collection; queries are scoped server-side, not in the UI |
| Upload validation | Files are validated by magic bytes (content), not extension alone |
| Ephemeral storage | Sessions expire and are fully cleaned up (collection, BM25 index, uploads, history) |
| No key in frontend | The Groq key is never sent to the browser or reflected in any API response |

---

## Project Structure

```
DocMind/
├── app.py                  # Streamlit entry point (UI only)
├── requirements.txt        # Pinned dependencies (Python 3.12)
├── requirements-docling.txt # Optional heavy deps for Docling
├── .env.example            # Environment variable template
├── .streamlit/
│   └── config.toml         # Streamlit server config
├── docmind/                # Core package
│   ├── config.py           # All settings from env
│   ├── validation.py       # Stage 1 — file validation
│   ├── parsing.py          # Stage 2 — multi-format parsing + OCR
│   ├── chunking.py         # Stage 3 — recursive token splitter
│   ├── embeddings.py       # Stage 4 — local CPU embeddings
│   ├── vector_store.py     # Stage 5 — ChromaDB per-session store
│   ├── keyword_index.py    # BM25 in-memory index
│   ├── retrieval.py        # Stage 6 — hybrid retrieval + rerank
│   ├── prompt.py           # Prompt builder
│   ├── llm.py              # Stage 7 — Groq API (only egress point)
│   ├── formatting.py       # Stage 12 — markdown cleanup
│   ├── session.py          # Session lifecycle + orchestration
│   └── logging_config.py   # Structured logging + key redaction
└── tests/
    ├── test_validation.py  # Stage 1 tests
    ├── test_pipeline.py    # Stages 2–6, 10, 12
    ├── test_api_key_audit.py # Static key containment audit
    ├── test_generation.py  # Stage 7 & 9 (needs API key)
    └── test_e2e.py         # Full end-to-end flow
```

---

## License

MIT
