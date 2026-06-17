"""Stage 7 — LLM client (the ONLY place the Groq API key is used).

The key is read from config (env-sourced) at call time via require_groq_key(),
never hardcoded, never logged, never returned to the frontend. This module is
the single point of egress for the API key in the whole system.
"""
from __future__ import annotations

from typing import Dict, Iterator, List, Optional

from .config import GROQ_MODELS, config
from .logging_config import get_logger

logger = get_logger(__name__)

# Substrings that identify non-chat models (speech, vision-encoder, guard, embed).
_NON_CHAT_PATTERNS = ("whisper", "tts", "guard", "shield", "embed", "vision")


def fetch_models_from_api(api_key: Optional[str] = None) -> List[str]:
    """Fetch the live list of active chat models from the Groq models endpoint.

    Returns model IDs sorted alphabetically, with the configured default first.
    Falls back to the hardcoded GROQ_MODELS list on any error (no key, network, etc.).

    `api_key` overrides the env-sourced key (used for per-account keys); when None
    the configured key is used, preserving the original Streamlit behavior.
    """
    import requests

    key = api_key or config.groq_api_key
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


def _client(api_key: Optional[str] = None):
    """Construct a Groq client. Raises a clear error if no key is available.

    `api_key` (a per-account key) takes precedence; otherwise the env-sourced
    key is required via config, preserving the original behavior.
    """
    from groq import Groq

    return Groq(api_key=api_key or config.require_groq_key())


def _strip_think(deltas: Iterator[str]) -> Iterator[str]:
    """Drop reasoning traces wrapped in <think>...</think> from a delta stream.

    Reasoning models (DeepSeek-R1, Qwen, etc.) sometimes inline their chain of
    thought in the content. The tags can land on any chunk boundary, so we run a
    tiny state machine over the concatenated stream: suppress everything inside a
    think block, and hold back any trailing partial that *might* be the start of a
    tag until we've seen enough characters to decide.
    """
    open_tag, close_tag = "<think>", "</think>"
    buffer = ""
    inside = False

    def _maybe_partial_tag(text: str, tag: str) -> bool:
        # True if `text` is a non-empty proper prefix of `tag` (could still grow into it).
        return bool(text) and tag.startswith(text) and text != tag

    for delta in deltas:
        if not delta:
            continue
        buffer += delta
        while buffer:
            if inside:
                idx = buffer.find(close_tag)
                if idx == -1:
                    # Keep only a possible partial closing tag at the tail.
                    keep = 0
                    for k in range(1, min(len(close_tag), len(buffer)) + 1):
                        if close_tag.startswith(buffer[-k:]):
                            keep = k
                            break
                    buffer = buffer[-keep:] if keep else ""
                    break
                buffer = buffer[idx + len(close_tag):]
                inside = False
            else:
                idx = buffer.find(open_tag)
                if idx == -1:
                    # Emit everything except a possible partial opening tag at the tail.
                    keep = 0
                    for k in range(1, min(len(open_tag), len(buffer)) + 1):
                        if open_tag.startswith(buffer[-k:]):
                            keep = k
                            break
                    emit = buffer[:-keep] if keep else buffer
                    if emit:
                        yield emit
                    buffer = buffer[-keep:] if keep else ""
                    break
                if idx:
                    yield buffer[:idx]
                buffer = buffer[idx + len(open_tag):]
                inside = True

    # Flush any remaining text that turned out not to be a tag.
    if buffer and not inside and not _maybe_partial_tag(buffer, open_tag):
        yield buffer


def _raw_stream(
    client, messages: List[Dict[str, str]], model: str
) -> Iterator[str]:
    """Yield raw content deltas from Groq, asking it to hide reasoning at the source.

    `reasoning_format="hidden"` keeps chain-of-thought out of `content` for
    reasoning models; models that reject the parameter fall back to a plain call.
    """
    def _create(**extra):
        return client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=1024,
            stream=True,
            **extra,
        )

    try:
        stream = _create(reasoning_format="hidden")
    except Exception:
        stream = _create()

    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def stream_answer(
    messages: List[Dict[str, str]], model: str, api_key: Optional[str] = None
) -> Iterator[str]:
    """Stream the assistant answer token-by-token, reasoning traces removed.

    Yields text deltas. Any API error is logged server-side and surfaced as a
    short, friendly message yielded to the UI. `api_key` selects a per-account
    key; when None the configured env key is used.
    """
    if not model or not model.strip():
        model = config.default_model

    try:
        from groq import AuthenticationError
    except Exception:  # pragma: no cover — SDK always provides this
        AuthenticationError = ()  # type: ignore[assignment]

    try:
        client = _client(api_key)
        yield from _strip_think(_raw_stream(client, messages, model))
    except AuthenticationError as e:  # type: ignore[misc]
        logger.warning("Groq rejected the API key: %s", e)
        yield (
            "\n\n_Your Groq API key was rejected. "
            "Please update it in Settings and try again._"
        )
    except Exception as e:
        logger.exception("Groq generation failed: %s", e)
        yield (
            "\n\n_Sorry — I couldn't generate an answer right now. "
            "Please check the API key and try again._"
        )


def generate_answer(
    messages: List[Dict[str, str]], model: str, api_key: Optional[str] = None
) -> str:
    """Non-streaming convenience wrapper (used in tests)."""
    return "".join(stream_answer(messages, model, api_key))
