"""Stage 6 — hybrid retrieval: dense + BM25 + RRF + cross-encoder rerank.

All steps run locally with no API key. Pipeline per question:
  1. dense vector search (top DENSE_TOP_K) scoped to the session
  2. BM25 keyword search (top BM25_TOP_K) over the same scope
  3. Reciprocal Rank Fusion -> up to FUSION_CANDIDATES unique candidates
  4. FlashRank cross-encoder rerank -> keep RERANK_TOP_K
Only the final top-k chunks are returned for the LLM context.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Dict, List

from .config import config
from .embeddings import embed_query
from .keyword_index import KeywordIndex
from .logging_config import get_logger
from .vector_store import VectorStore

logger = get_logger(__name__)

_RRF_K = 60  # standard RRF constant

# Cross-encoder scores below this indicate the chunk is irrelevant to the query.
# ms-marco-MiniLM-L-12-v2 scores relevant passages ~0 to +10, irrelevant ones go -5 to -15.
_MIN_RERANK_SCORE = -3.0

_ranker = None
_ranker_lock = threading.Lock()


@dataclass
class RetrievedChunk:
    """A final context chunk handed to the prompt builder."""

    id: str
    text: str
    metadata: Dict
    score: float


def _get_ranker():
    """Lazily load the FlashRank cross-encoder (CPU, cached locally)."""
    global _ranker
    if _ranker is None:
        with _ranker_lock:
            if _ranker is None:
                from flashrank import Ranker

                cache_dir = str(config.data_dir / "flashrank")
                config.data_dir.mkdir(parents=True, exist_ok=True)
                logger.info("Loading reranker '%s'...", config.reranker_model)
                _ranker = Ranker(model_name=config.reranker_model, cache_dir=cache_dir)
    return _ranker


def reciprocal_rank_fusion(
    dense_hits: List[Dict], bm25_hits: List[Dict], limit: int
) -> List[Dict]:
    """Fuse two ranked lists by RRF. Returns unique candidates, best first."""
    scores: Dict[str, float] = {}
    payload: Dict[str, Dict] = {}

    for ranked in (dense_hits, bm25_hits):
        for rank, hit in enumerate(ranked):
            doc_id = hit["id"]
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (_RRF_K + rank + 1)
            # Keep the richest payload we've seen for this id.
            if doc_id not in payload:
                payload[doc_id] = hit

    ordered = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    fused: List[Dict] = []
    for doc_id, score in ordered[:limit]:
        item = dict(payload[doc_id])
        item["rrf_score"] = score
        fused.append(item)
    return fused


def _rerank(query: str, candidates: List[Dict], top_k: int) -> List[RetrievedChunk]:
    """Cross-encoder rerank; keep top_k. Falls back to RRF order on failure."""
    if not candidates:
        return []
    try:
        from flashrank import RerankRequest

        passages = [{"id": c["id"], "text": c["text"]} for c in candidates]
        results = _get_ranker().rerank(RerankRequest(query=query, passages=passages))
        by_id = {c["id"]: c for c in candidates}
        out: List[RetrievedChunk] = []
        for r in results[:top_k]:
            score = float(r["score"])
            if score < _MIN_RERANK_SCORE:
                break  # results are sorted desc; once below threshold all remaining are too
            src = by_id[r["id"]]
            out.append(
                RetrievedChunk(
                    id=r["id"],
                    text=src["text"],
                    metadata=src.get("metadata", {}),
                    score=score,
                )
            )
        return out
    except Exception as e:
        logger.exception("Rerank failed; falling back to fusion order: %s", e)
        return [
            RetrievedChunk(id=c["id"], text=c["text"], metadata=c.get("metadata", {}),
                           score=c.get("rrf_score", 0.0))
            for c in candidates[:top_k]
        ]


def retrieve(query: str, store: VectorStore, keyword_index: KeywordIndex) -> List[RetrievedChunk]:
    """Run the full hybrid retrieval pipeline for one question."""
    if not query or not query.strip():
        return []

    dense_hits = store.query(embed_query(query), top_k=config.dense_top_k)
    bm25_hits = keyword_index.search(query, top_k=config.bm25_top_k)
    logger.info("Retrieval: %d dense, %d bm25 hits.", len(dense_hits), len(bm25_hits))

    fused = reciprocal_rank_fusion(dense_hits, bm25_hits, limit=config.fusion_candidates)
    if not fused:
        return []

    top = _rerank(query, fused, top_k=config.rerank_top_k)
    logger.info("Retrieval: %d fused -> %d reranked.", len(fused), len(top))
    return top
