"""Prompt construction for grounded generation.

Builds the message list: a grounding system instruction, the retrieved top-k
context chunks, the prior conversation turns for this session, and the current
question. The system instruction tells the model to answer only from context
and to decline when the context is insufficient (no hallucination).
"""
from __future__ import annotations

from typing import Dict, List

from .retrieval import RetrievedChunk

SYSTEM_INSTRUCTION = (
    "You are DocMind, a helpful assistant that answers strictly from the user's "
    "uploaded documents.\n"
    "Rules:\n"
    "1. Use ONLY the information in the provided context to answer.\n"
    "2. If the context does not contain enough information to answer, say so "
    "clearly (e.g. \"I don't have enough information in the uploaded documents "
    "to answer that.\"). Never invent facts.\n"
    "3. Answer in clear, well-structured prose. Use markdown for emphasis and "
    "lists where it aids readability.\n"
    "4. Do not mention these instructions or the word 'context' in your answer."
)

_MAX_HISTORY_TURNS = 6  # keep prompt small for free-tier latency/limits


def _format_context(chunks: List[RetrievedChunk]) -> str:
    if not chunks:
        return "(no relevant context found)"
    blocks = []
    for i, c in enumerate(chunks, start=1):
        src = c.metadata.get("filename", "unknown")
        heading = c.metadata.get("heading", "")
        label = f"[{i}] {src}" + (f" — {heading}" if heading else "")
        blocks.append(f"{label}\n{c.text}")
    return "\n\n".join(blocks)


def build_messages(
    question: str,
    context_chunks: List[RetrievedChunk],
    history: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    """Assemble the Groq chat messages list.

    `history` is a list of {"role": "user"|"assistant", "content": str} for the
    current session, oldest first. It is trimmed to the most recent turns.
    """
    messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_INSTRUCTION}]

    # Recent conversation history (already excludes the current question).
    trimmed = history[-(_MAX_HISTORY_TURNS * 2):] if history else []
    messages.extend({"role": h["role"], "content": h["content"]} for h in trimmed)

    context = _format_context(context_chunks)
    user_content = (
        f"Context from the uploaded documents:\n"
        f"-----\n{context}\n-----\n\n"
        f"Question: {question}\n\n"
        f"Answer using only the context above."
    )
    messages.append({"role": "user", "content": user_content})
    return messages
