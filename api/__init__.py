"""FastAPI service exposing the DocMind pipeline to the Next.js frontend.

This package wraps the existing `docmind` pipeline (parsing, embeddings,
retrieval, generation) behind a small HTTP/SSE API plus lightweight auth.
The core pipeline is reused unchanged; nothing here duplicates its logic.
"""
