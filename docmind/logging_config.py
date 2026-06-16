"""Logging setup. Full tracebacks go server-side; the UI shows friendly messages.

A redaction filter guarantees the Groq API key never lands in a log line even
if some value is accidentally passed to a logger.
"""
from __future__ import annotations

import logging
import os
import sys

_CONFIGURED = False


class _SecretRedactionFilter(logging.Filter):
    """Strip the Groq API key from any log record, defence-in-depth."""

    def filter(self, record: logging.LogRecord) -> bool:
        key = os.getenv("GROQ_API_KEY", "").strip()
        if key and len(key) >= 8:
            msg = record.getMessage()
            if key in msg:
                record.msg = msg.replace(key, "***REDACTED***")
                record.args = ()
        return True


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logging once. Safe to call repeatedly."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    handler.addFilter(_SecretRedactionFilter())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet noisy third-party loggers.
    for noisy in ("httpx", "urllib3", "sentence_transformers", "chromadb"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger for the given module name."""
    setup_logging()
    return logging.getLogger(name)
