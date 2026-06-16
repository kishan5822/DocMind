"""Stage 3 — chunking.

Recursive splitter targeting 512 tokens with 15% overlap (both configurable).
Token counts use tiktoken's cl100k_base, a stable proxy for chunk sizing. Each
chunk is prefixed with required metadata ("Source: <file> | Section: <heading>")
before embedding — this measurably improves retrieval.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import tiktoken

from .config import config
from .logging_config import get_logger
from .parsing import ParsedDocument

logger = get_logger(__name__)

_ENCODER = tiktoken.get_encoding("cl100k_base")

# Separators tried in order, coarsest first.
_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]


def count_tokens(text: str) -> int:
    """Token count via the shared cl100k encoder."""
    return len(_ENCODER.encode(text))


@dataclass
class Chunk:
    """One embeddable unit.

    `text` is what gets embedded and BM25-indexed (metadata prefix included).
    `raw_text` is the original content without the prefix, for display/debug.
    """

    id: str
    text: str
    raw_text: str
    metadata: Dict[str, str] = field(default_factory=dict)

    @property
    def token_count(self) -> int:
        return count_tokens(self.text)


def _build_prefix(filename: str, heading: Optional[str]) -> str:
    prefix = f"Source: {filename}"
    if heading:
        prefix += f" | Section: {heading}"
    return prefix


def _split_recursive(text: str, max_tokens: int, seps: List[str]) -> List[str]:
    """Split text into pieces each <= max_tokens, recursing through separators."""
    text = text.strip()
    if not text:
        return []
    if count_tokens(text) <= max_tokens:
        return [text]

    if not seps:
        # No separators left: hard-split on token boundaries.
        return _hard_split_tokens(text, max_tokens)

    sep = seps[0]
    rest = seps[1:]
    if sep == "":
        return _hard_split_tokens(text, max_tokens)

    parts = text.split(sep)
    pieces: List[str] = []
    for part in parts:
        if not part.strip():
            continue
        if count_tokens(part) <= max_tokens:
            pieces.append(part.strip())
        else:
            pieces.extend(_split_recursive(part, max_tokens, rest))
    return pieces


def _hard_split_tokens(text: str, max_tokens: int) -> List[str]:
    """Last resort: split by raw token windows (e.g. a giant unbroken string)."""
    tokens = _ENCODER.encode(text)
    out: List[str] = []
    for i in range(0, len(tokens), max_tokens):
        out.append(_ENCODER.decode(tokens[i : i + max_tokens]).strip())
    return [p for p in out if p]


def _merge_with_overlap(pieces: List[str], max_tokens: int, overlap_tokens: int) -> List[str]:
    """Greedily merge pieces into windows <= max_tokens, carrying overlap forward."""
    chunks: List[str] = []
    current: List[str] = []
    current_tokens = 0

    for piece in pieces:
        ptokens = count_tokens(piece)
        if current and current_tokens + ptokens > max_tokens:
            chunks.append(" ".join(current).strip())
            # Build overlap tail from the end of the current window.
            overlap: List[str] = []
            otokens = 0
            for prev in reversed(current):
                ptok = count_tokens(prev)
                if otokens + ptok > overlap_tokens:
                    break
                overlap.insert(0, prev)
                otokens += ptok
            current = overlap[:]
            current_tokens = otokens
        current.append(piece)
        current_tokens += ptokens

    if current:
        chunks.append(" ".join(current).strip())
    return [c for c in chunks if c]


def chunk_document(doc: ParsedDocument) -> List[Chunk]:
    """Chunk a parsed document into prefixed, overlapping token windows."""
    max_tokens = config.chunk_size_tokens
    overlap = config.chunk_overlap_tokens
    # Reserve room for the metadata prefix so prefixed chunks stay near target.
    out: List[Chunk] = []
    index = 0

    for section in doc.sections:
        if not section.text.strip():
            continue
        prefix = _build_prefix(doc.filename, section.heading)
        prefix_tokens = count_tokens(prefix) + 2  # +2 for the joining newline
        body_budget = max(64, max_tokens - prefix_tokens)

        pieces = _split_recursive(section.text, body_budget, _SEPARATORS)
        merged = _merge_with_overlap(pieces, body_budget, overlap)

        for raw in merged:
            chunk_text = f"{prefix}\n{raw}"
            out.append(
                Chunk(
                    id=f"{doc.filename}::{index}",
                    text=chunk_text,
                    raw_text=raw,
                    metadata={
                        "filename": doc.filename,
                        "heading": section.heading or "",
                        "chunk_index": str(index),
                    },
                )
            )
            index += 1

    logger.info("Chunked '%s' into %d chunks.", doc.filename, len(out))
    return out


def chunk_documents(docs: List[ParsedDocument]) -> List[Chunk]:
    """Chunk many documents. IDs are '{filename}::{index}' — unique per session
    because the app prevents re-ingesting the same filename."""
    all_chunks: List[Chunk] = []
    for doc in docs:
        all_chunks.extend(chunk_document(doc))
    return all_chunks
