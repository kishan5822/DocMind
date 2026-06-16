"""Stage 7 — LLM client (the ONLY place the Groq API key is used).

The key is read from config (env-sourced) at call time via require_groq_key(),
never hardcoded, never logged, never returned to the frontend. This module is
the single point of egress for the API key in the whole system.
"""
from __future__ import annotations

from typing import Dict, Iterator, List

from .config import GROQ_MODELS, config
from .logging_config import get_logger

logger = get_logger(__name__)


def available_models() -> List[str]:
    """Models offered in the selector; default first."""
    default = config.default_model
    ordered = [default] + [m for m in GROQ_MODELS if m != default]
    return ordered


def _client():
    """Construct a Groq client. Raises a clear error if the key is missing."""
    from groq import Groq

    return Groq(api_key=config.require_groq_key())


def stream_answer(messages: List[Dict[str, str]], model: str) -> Iterator[str]:
    """Stream the assistant answer token-by-token.

    Yields text deltas. Any API error is logged server-side and surfaced as a
    short, friendly message yielded to the UI.
    """
    if model not in available_models():
        logger.warning("Unknown model '%s'; using default.", model)
        model = config.default_model

    try:
        client = _client()
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=1024,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as e:
        logger.exception("Groq generation failed: %s", e)
        yield (
            "\n\n_Sorry — I couldn't generate an answer right now. "
            "Please check the API key and try again._"
        )


def generate_answer(messages: List[Dict[str, str]], model: str) -> str:
    """Non-streaming convenience wrapper (used in tests)."""
    return "".join(stream_answer(messages, model))
