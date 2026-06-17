"""Symmetric encryption for secrets at rest (the per-account Groq API key).

We never store a user's Groq key in plaintext. It is encrypted with Fernet
(AES-128-CBC + HMAC) using a key derived from the APP_SECRET_KEY environment
variable, and decrypted only when a chat/model request needs to call Groq.

Set APP_SECRET_KEY in production so stored keys survive restarts and stay secret.
The dev fallback is intentionally insecure and logged loudly.
"""
from __future__ import annotations

import base64
import hashlib
import os
from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from docmind.logging_config import get_logger

logger = get_logger(__name__)


def _secret() -> str:
    secret = os.getenv("APP_SECRET_KEY", "").strip()
    if not secret:
        logger.warning(
            "APP_SECRET_KEY not set; using an insecure dev default. "
            "Set it in production so stored API keys remain secret across restarts."
        )
        return "docmind-dev-app-secret-change-me"
    return secret


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    # Derive a stable 32-byte urlsafe-base64 key from the configured secret.
    digest = hashlib.sha256(_secret().encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plaintext: str) -> str:
    """Encrypt a secret string for storage. Returns urlsafe token text."""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(token: Optional[str]) -> Optional[str]:
    """Decrypt a stored token. Returns None if empty or undecryptable
    (e.g. the secret changed), so callers degrade to 'no key set'."""
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as e:
        logger.warning("Could not decrypt a stored secret: %s", e)
        return None
