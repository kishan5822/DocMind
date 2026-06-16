"""Stage 12 — output formatting.

The UI renders answers with st.markdown, so bold/italics/headings become real
formatting rather than literal asterisks. This module cleans common LLM
artifacts before rendering: a whole-answer code-fence wrapper, unbalanced
emphasis markers, and excessive blank lines. The goal is clean, readable text
with no stray markdown control characters showing through.
"""
from __future__ import annotations

import re

_FENCE_WRAP_RE = re.compile(r"^\s*```(?:markdown|md|text)?\s*\n(.*)\n```\s*$", re.DOTALL)
_MULTI_BLANK_RE = re.compile(r"\n{3,}")
_TRAILING_WS_RE = re.compile(r"[ \t]+\n")


def format_answer(text: str) -> str:
    """Return clean markdown safe to pass to st.markdown."""
    if not text:
        return ""

    cleaned = text.strip()

    # 1. Unwrap an answer the model wrapped entirely in a code fence.
    m = _FENCE_WRAP_RE.match(cleaned)
    if m:
        cleaned = m.group(1).strip()

    # 2. Normalise line endings and trailing whitespace.
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = _TRAILING_WS_RE.sub("\n", cleaned)

    # 3. Balance ** bold markers so none render as literal asterisks.
    cleaned = _balance_marker(cleaned, "**")

    # 4. Collapse runs of blank lines.
    cleaned = _MULTI_BLANK_RE.sub("\n\n", cleaned)

    return cleaned.strip()


def _balance_marker(text: str, marker: str) -> str:
    """If a paired marker (e.g. **) has an odd count, drop the dangling one."""
    count = text.count(marker)
    if count % 2 == 0:
        return text
    # Remove the last occurrence to rebalance.
    idx = text.rfind(marker)
    if idx == -1:
        return text
    return text[:idx] + text[idx + len(marker):]
