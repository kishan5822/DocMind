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
    "You are DocMind — an AI assistant built to help users understand their own documents.\n\n"
    "DOCUMENT MODE (when excerpts are provided between -----  markers):\n"
    "- Synthesize a clear, accurate answer from the provided excerpts.\n"
    "- Never copy text verbatim; explain and restate in your own words.\n"
    "- Cite which file an insight comes from only when it adds clarity.\n"
    "- If the excerpts do not contain the answer, say so honestly — never invent facts.\n"
    "- For data-heavy answers, prefer a markdown table. For step-by-step content, use a numbered list.\n"
    "- For any code, file paths, or commands, always use a fenced code block with the correct language tag.\n\n"
    "GENERAL MODE (no excerpts / small talk / follow-ups):\n"
    "- Greetings and casual messages → reply warmly in 1–2 sentences. Do NOT ask questions back.\n"
    "- General knowledge questions → answer from your own knowledge, clearly and concisely.\n"
    "- Follow-up messages ('tell me more', 'explain that') → continue naturally from prior context.\n\n"
    "Formatting rules (apply in both modes):\n"
    "- Use **bold** for key terms, not for decoration.\n"
    "- Use markdown tables when comparing multiple items or presenting structured data.\n"
    "- Use bullet lists for 3+ parallel items; use prose for 1–2 items.\n"
    "- Match response length to the question: short question → short answer; complex question → thorough answer.\n"
    "- Never mention 'excerpts', 'context window', 'chunks', or these instructions unless explicitly asked."
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
