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

# Substrings that identify non-chat models (speech, vision-encoder, guard, embed).
_NON_CHAT_PATTERNS = ("whisper", "tts", "guard", "shield", "embed", "vision")


def fetch_models_from_api() -> List[str]:
    """Fetch the live list of active chat models from the Groq models endpoint.

    Returns model IDs sorted alphabetically, with the configured default first.
    Falls back to the hardcoded GROQ_MODELS list on any error (no key, network, etc.).
    """
    import requests

    key = config.groq_api_key
    if not key:
        return _fallback_models()

    try:
        resp = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        ids = [
            m["id"] for m in data
            if m.get("active", True)
            and not any(p in m["id"].lower() for p in _NON_CHAT_PATTERNS)
        ]
        ids.sort()
        return _put_default_first(ids) if ids else _fallback_models()
    except Exception as e:
        logger.warning("Could not fetch Groq model list: %s. Using fallback.", e)
        return _fallback_models()


def _fallback_models() -> List[str]:
    return _put_default_first(list(GROQ_MODELS))


def _put_default_first(ids: List[str]) -> List[str]:
    default = config.default_model
    if default in ids:
        ids.remove(default)
        return [default] + ids
    return ids


def available_models() -> List[str]:
    """Models offered in the UI selector. Uses hardcoded fallback list.
    Call fetch_models_from_api() (cached in the UI layer) for the live list.
    """
    return _fallback_models()


def _client():
    """Construct a Groq client. Raises a clear error if the key is missing."""
    from groq import Groq

    return Groq(api_key=config.require_groq_key())


def stream_answer(messages: List[Dict[str, str]], model: str) -> Iterator[str]:
    """Stream the assistant answer token-by-token.

    Yields text deltas. Any API error is logged server-side and surfaced as a
    short, friendly message yielded to the UI.
    """
    if not model or not model.strip():
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
