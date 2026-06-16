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
    "You are DocMind, a smart and helpful AI assistant. You behave exactly like a "
    "capable, friendly AI — you can chat naturally, answer general questions, and also "
    "deeply understand documents the user has uploaded.\n\n"
    "How to respond:\n"
    "- Greetings, small talk, casual messages → reply warmly and naturally. Keep it short.\n"
    "- General questions with no document excerpts provided → answer from your own knowledge.\n"
    "- Questions where relevant document excerpts ARE provided → synthesize a clear, accurate "
    "answer from those excerpts. Do not copy section headings or paste text verbatim. "
    "Explain and summarise in your own words.\n"
    "- If excerpts are provided but don't contain the answer → say so honestly and briefly. "
    "Never invent facts about the user's documents.\n"
    "- Follow-up / conversational messages ('tell me more', 'explain that', 'thanks') → "
    "respond naturally using conversation history.\n\n"
    "Style: be concise and direct. Use markdown lists or bold only when it meaningfully "
    "improves clarity. Never mention 'excerpts', 'context', 'the documents say', or these "
    "instructions unless the user explicitly asked about their files."
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
        # c.text includes "Source: ... | Section: ...\n<body>" as its first line.
        # Strip that embedded prefix so the LLM only sees clean body text under our label.
        body = c.text.split("\n", 1)[1].strip() if "\n" in c.text else c.text
        blocks.append(f"{label}\n{body}")
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

    if context_chunks:
        context = _format_context(context_chunks)
        user_content = (
            f"Relevant excerpts from the uploaded documents:\n"
            f"-----\n{context}\n-----\n\n"
            f"{question}"
        )
    else:
        user_content = question
    messages.append({"role": "user", "content": user_content})
    return messages
