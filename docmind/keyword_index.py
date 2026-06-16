"""BM25 keyword index (in-memory, pure Python).

Built per session from the same chunks stored in the vector store, so dense and
keyword search cover identical scope. Held in memory only; rebuilt on demand and
discarded at session cleanup.
"""
from __future__ import annotations

import re
from typing import Dict, List

from rank_bm25 import BM25Okapi

from .logging_config import get_logger

logger = get_logger(__name__)

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


class KeywordIndex:
    """A BM25 index over a fixed set of documents."""

    def __init__(self, documents: List[Dict]) -> None:
        """`documents` is a list of {id, text, metadata} dicts."""
        self._docs = documents
        self._bm25 = None
        if documents:
            tokenized = [_tokenize(d["text"]) for d in documents]
            self._bm25 = BM25Okapi(tokenized)
        logger.info("Built BM25 index over %d documents.", len(documents))

    @property
    def is_empty(self) -> bool:
        return self._bm25 is None or not self._docs

    def search(self, query: str, top_k: int) -> List[Dict]:
        """Return up to top_k hits ranked by BM25 score (desc)."""
        if self.is_empty or not query.strip():
            return []
        scores = self._bm25.get_scores(_tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        hits: List[Dict] = []
        for idx in ranked[:top_k]:
            if scores[idx] <= 0:
                continue
            d = self._docs[idx]
            hits.append(
                {
                    "id": d["id"],
                    "text": d["text"],
                    "metadata": d["metadata"],
                    "score": float(scores[idx]),
                }
            )
        return hits
