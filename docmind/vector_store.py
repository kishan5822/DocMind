"""Stage 5 — vector store with strict per-session isolation.

Each session gets its own ChromaDB collection. Retrieval is scoped to a single
collection, so one session's query can never reach another's chunks. Isolation
is enforced here, at the data-access layer — not in the UI.

Embeddings are computed by our local embedder and passed in explicitly; Chroma
is never given an embedding function or an API key.
"""
from __future__ import annotations

import re
import threading
from typing import Dict, List, Optional

import chromadb
from chromadb.config import Settings

from .config import config
from .chunking import Chunk
from .logging_config import get_logger

logger = get_logger(__name__)

_client = None
_client_lock = threading.Lock()


def _get_client():
    """Single shared persistent client rooted at the configured data dir."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                path = str(config.data_dir / "chroma")
                config.data_dir.mkdir(parents=True, exist_ok=True)
                _client = chromadb.PersistentClient(
                    path=path,
                    settings=Settings(anonymized_telemetry=False, allow_reset=True),
                )
                logger.info("ChromaDB persistent client at %s", path)
    return _client


def _collection_name(session_id: str) -> str:
    """Map a session id to a safe Chroma collection name."""
    safe = re.sub(r"[^a-zA-Z0-9]", "", session_id)
    if not safe:
        raise ValueError("session_id must contain alphanumeric characters.")
    return f"session-{safe}"


class VectorStore:
    """Per-session view over a Chroma collection. All ops scoped to one session."""

    def __init__(self, session_id: str) -> None:
        if not session_id or not session_id.strip():
            raise ValueError("session_id is required.")
        self.session_id = session_id
        self._name = _collection_name(session_id)
        self._col()  # ensure it exists up front

    def _col(self):
        """Resolve the collection on every op (idempotent get_or_create).

        Fetching by name each time keeps the handle valid even if the
        collection was deleted out-of-band (e.g. after cleanup), so the
        session self-heals instead of holding a stale handle.
        """
        return _get_client().get_or_create_collection(
            name=self._name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, chunks: List[Chunk], embeddings: List[List[float]]) -> None:
        """Store chunks + precomputed embeddings, tagged with this session id."""
        if not chunks:
            return
        if len(chunks) != len(embeddings):
            raise ValueError("chunks and embeddings length mismatch.")
        self._col().add(
            ids=[c.id for c in chunks],
            embeddings=embeddings,
            documents=[c.text for c in chunks],
            metadatas=[{**c.metadata, "session_id": self.session_id} for c in chunks],
        )
        logger.info("Stored %d chunks in collection '%s'.", len(chunks), self._name)

    def query(self, query_embedding: List[float], top_k: int) -> List[Dict]:
        """Dense search within THIS session only. Returns ranked hit dicts."""
        col = self._col()
        count = col.count()
        if count == 0:
            return []
        res = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, count),
            include=["documents", "metadatas", "distances"],
        )
        hits: List[Dict] = []
        ids = res.get("ids", [[]])[0]
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        dists = res.get("distances", [[]])[0]
        for i, doc_id in enumerate(ids):
            hits.append(
                {
                    "id": doc_id,
                    "text": docs[i],
                    "metadata": metas[i],
                    "distance": dists[i],
                }
            )
        return hits

    def count(self) -> int:
        return self._col().count()

    def all_documents(self) -> List[Dict]:
        """Return every stored chunk (for building the BM25 index)."""
        col = self._col()
        if col.count() == 0:
            return []
        res = col.get(include=["documents", "metadatas"])
        out: List[Dict] = []
        for i, doc_id in enumerate(res.get("ids", [])):
            out.append(
                {
                    "id": doc_id,
                    "text": res["documents"][i],
                    "metadata": res["metadatas"][i],
                }
            )
        return out

    def delete_by_filename(self, filename: str) -> int:
        """Delete all chunks/vectors for one file. Returns count removed."""
        col = self._col()
        res = col.get(where={"filename": filename})
        ids = res.get("ids", [])
        if ids:
            col.delete(ids=ids)
            logger.info(
                "Deleted %d chunks for '%s' from '%s'.", len(ids), filename, self._name
            )
        return len(ids)

    def delete(self) -> None:
        """Drop this session's collection entirely."""
        try:
            _get_client().delete_collection(name=self._name)
            logger.info("Deleted collection '%s'.", self._name)
        except Exception as e:
            logger.warning("Could not delete collection '%s': %s", self._name, e)
