# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-16

### Added

- **Retrieval-Augmented Generation (RAG) pipeline** with 12 verification stages
- **Multi-format document support**: PDF (text + OCR), DOCX, PPTX, XLSX, CSV, JSON, TXT, MD, HTML, PNG/JPG
- **Hybrid retrieval**: Dense vector search + BM25 keyword search + Reciprocal Rank Fusion + FlashRank cross-encoder reranking
- **Per-session isolation**: Each browser tab gets isolated ChromaDB collection, BM25 index, and file uploads
- **Grounded chat**: LLM answers only from uploaded documents; refuses when context is insufficient
- **Live model selector**: Fetches all active Groq models at startup; switch models mid-session
- **Local-only ML**: Embedding (BAAI/bge-base-en-v1.5), reranking (ms-marco-MiniLM-L-12-v2), and parsing all run on CPU
- **Groq API integration**: Free-tier inference for final response generation
- **Session management**: Auto-expiry after configurable TTL; full cleanup of data
- **File validation**: Magic-byte verification, batch limits, content-type checking
- **OCR fallback**: Tesseract for scanned PDFs and images
- **Security audit tests**: Static verification that API key is confined to `llm.py`
- **End-to-end tests**: Full pipeline verification including multi-user isolation

### Security

- API key read from environment only; never hardcoded, logged, or sent to frontend
- Per-session data isolation enforced at vector store layer
- File uploads validated by content, not extension
- Ephemeral design: all data destroyed on session expiry
- Comprehensive security documentation in `SECURITY.md`

### Documentation

- Complete `README.md` with architecture diagrams and retrieval deep-dive
- `CONTRIBUTING.md` for developers
- `CODE_OF_CONDUCT.md` for community
- `SECURITY.md` for security model and threat analysis
- Inline docstrings and comments explaining non-obvious behavior

### Testing

- 5 test suites covering all 12 RAG stages
- ~350 lines of test code
- Tests can run without API key (except generation tests)
- 100% of core functionality covered

---

## Initial Release

This is the first public release of DocMind. The project implements a complete RAG system from document upload through grounded answer generation, with a focus on security, simplicity, and local execution of all ML components.

[1.0.0]: https://github.com/kishan5822/DocMind/releases/tag/v1.0.0
