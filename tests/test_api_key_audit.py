"""Stage 8 — API-key audit (static inspection).

Verifies by code inspection that:
  * the Groq client (`groq` import / Groq()) is used only in llm.py
  * the API key is read only in config.py (source) and llm.py (use), with
    logging_config.py allowed solely for redaction
No embedding/parsing/retrieval module may touch the key or the Groq SDK.

Run: python -m tests.test_api_key_audit
"""
from __future__ import annotations

from pathlib import Path

PKG = Path(__file__).resolve().parent.parent / "docmind"

# Where each sensitive token is legitimately allowed to appear.
ALLOWED_GROQ_SDK = {"llm.py"}
ALLOWED_KEY_READ = {"config.py", "llm.py", "logging_config.py"}


def _check(label: str, cond: bool) -> None:
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}")
    if not cond:
        raise AssertionError(label)


def main() -> None:
    print("Stage 8: API-key audit (static)")
    offenders_sdk = []
    offenders_key = []

    for path in PKG.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        name = path.name
        if ("import groq" in text or "from groq" in text or "Groq(" in text) \
                and name not in ALLOWED_GROQ_SDK:
            offenders_sdk.append(name)
        if ("GROQ_API_KEY" in text or "groq_api_key" in text or "require_groq_key" in text) \
                and name not in ALLOWED_KEY_READ:
            offenders_key.append(name)

    _check(f"Groq SDK only in {ALLOWED_GROQ_SDK} (offenders: {offenders_sdk})", not offenders_sdk)
    _check(f"API key only in {ALLOWED_KEY_READ} (offenders: {offenders_key})", not offenders_key)

    # The key must never be hardcoded anywhere.
    for path in PKG.glob("*.py"):
        _check(f"no hardcoded gsk_ key in {path.name}", "gsk_" not in path.read_text(encoding="utf-8"))

    print("Stage 8: PASSED")


if __name__ == "__main__":
    main()
