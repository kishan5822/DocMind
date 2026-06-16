"""Stage 4 — embeddings (local, no API key).

Wraps BAAI/bge-base-en-v1.5 via sentence-transformers on CPU. The model is
loaded once, lazily, and cached. bge models want a short instruction prefixed
to *queries* (not documents) for best retrieval — handled here.

No network/API call happens at embed time. The only network access is the
one-time model download from the Hugging Face hub on first use.
"""
from __future__ import annotations

import threading
from typing import List

from .config import config
from .logging_config import get_logger

logger = get_logger(__name__)

# Recommended retrieval instruction for bge-*-en-v1.5 query embeddings.
_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "

_model = None
_model_lock = threading.Lock()
_EXPECTED_DIM = 768  # bge-base-en-v1.5


def _get_model():
    """Lazily load and cache the embedding model (thread-safe)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from sentence_transformers import SentenceTransformer

                logger.info("Loading embedding model '%s' on CPU...", config.embedding_model)
                _model = SentenceTransformer(config.embedding_model, device="cpu")
    return _model


def embed_documents(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """Embed document chunks. Returns L2-normalised vectors."""
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return vectors.tolist()


def embed_query(query: str) -> List[float]:
    """Embed a single search query with the bge query instruction."""
    if not query or not query.strip():
        raise ValueError("Cannot embed an empty query.")
    model = _get_model()
    vector = model.encode(
        _QUERY_INSTRUCTION + query.strip(),
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return vector.tolist()


def embedding_dim() -> int:
    """Return the embedding dimensionality (loads the model if needed)."""
    dim = _get_model().get_sentence_embedding_dimension()
    return dim if dim is not None else _EXPECTED_DIM
