"""Central configuration. All tunables and secrets come from environment variables.

The Groq API key is read here once and never logged or exposed. Every other
setting has a sensible default so the app runs out of the box for local dev.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from dotenv import load_dotenv

# Load .env if present. Real secrets live there; .env.example is the template.
load_dotenv()


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        raise ValueError(f"Env var {name!r} must be an integer, got {raw!r}")


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        raise ValueError(f"Env var {name!r} must be a float, got {raw!r}")


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# Free Groq models offered in the selector. 8B is the default (fastest).
GROQ_MODELS: List[str] = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gemma2-9b-it",
]


@dataclass(frozen=True)
class Config:
    """Immutable runtime configuration assembled from the environment."""

    # --- Secret (never log this) ---
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", "").strip())

    # --- Chunking ---
    chunk_size_tokens: int = field(default_factory=lambda: _get_int("CHUNK_SIZE_TOKENS", 512))
    chunk_overlap_ratio: float = field(default_factory=lambda: _get_float("CHUNK_OVERLAP_RATIO", 0.15))

    # --- Retrieval ---
    dense_top_k: int = field(default_factory=lambda: _get_int("DENSE_TOP_K", 25))
    bm25_top_k: int = field(default_factory=lambda: _get_int("BM25_TOP_K", 25))
    fusion_candidates: int = field(default_factory=lambda: _get_int("FUSION_CANDIDATES", 50))
    rerank_top_k: int = field(default_factory=lambda: _get_int("RERANK_TOP_K", 5))

    # --- Upload limits ---
    max_file_mb: int = field(default_factory=lambda: _get_int("MAX_FILE_MB", 10))
    max_batch_mb: int = field(default_factory=lambda: _get_int("MAX_BATCH_MB", 100))
    max_files_per_batch: int = field(default_factory=lambda: _get_int("MAX_FILES_PER_BATCH", 10))

    # --- Models ---
    default_model: str = field(default_factory=lambda: os.getenv("DEFAULT_MODEL", "llama-3.1-8b-instant"))
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5"))
    reranker_model: str = field(default_factory=lambda: os.getenv("RERANKER_MODEL", "ms-marco-MiniLM-L-12-v2"))

    # --- Session ---
    session_ttl_minutes: int = field(default_factory=lambda: _get_int("SESSION_TTL_MINUTES", 120))

    # --- Storage ---
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", ".docmind_data")).resolve())

    # --- OCR ---
    tesseract_cmd: str = field(default_factory=lambda: os.getenv("TESSERACT_CMD", "").strip())

    # --- Docling toggle ---
    enable_docling: bool = field(default_factory=lambda: _get_bool("ENABLE_DOCLING", False))

    @property
    def chunk_overlap_tokens(self) -> int:
        """Overlap expressed in tokens, derived from the ratio."""
        return max(0, int(self.chunk_size_tokens * self.chunk_overlap_ratio))

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_mb * 1024 * 1024

    @property
    def max_batch_bytes(self) -> int:
        return self.max_batch_mb * 1024 * 1024

    def require_groq_key(self) -> str:
        """Return the Groq key or raise a clear error. Call only at generation time."""
        if not self.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Add it to your .env file. "
                "It is required only for chat response generation."
            )
        return self.groq_api_key

    def validate(self) -> None:
        """Sanity-check numeric settings. Raises ValueError on bad config."""
        if self.chunk_size_tokens <= 0:
            raise ValueError("CHUNK_SIZE_TOKENS must be positive")
        if not (0.0 <= self.chunk_overlap_ratio < 1.0):
            raise ValueError("CHUNK_OVERLAP_RATIO must be in [0.0, 1.0)")
        for name, val in [
            ("DENSE_TOP_K", self.dense_top_k),
            ("BM25_TOP_K", self.bm25_top_k),
            ("FUSION_CANDIDATES", self.fusion_candidates),
            ("RERANK_TOP_K", self.rerank_top_k),
            ("MAX_FILE_MB", self.max_file_mb),
            ("MAX_BATCH_MB", self.max_batch_mb),
            ("MAX_FILES_PER_BATCH", self.max_files_per_batch),
        ]:
            if val <= 0:
                raise ValueError(f"{name} must be positive, got {val}")


# Module-level singleton. Import this everywhere.
config = Config()
config.validate()
