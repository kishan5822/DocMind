"""Lightweight auth: a SQLite users table, password hashing, and JWT tokens.

Kept deliberately small — no ORM, no server dependency beyond passlib + PyJWT.
The Groq key is never touched here; this module only gates API access.
"""
from __future__ import annotations

import os
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Optional

import jwt
from passlib.context import CryptContext

from docmind.config import config
from docmind.logging_config import get_logger

from .crypto import decrypt, encrypt

logger = get_logger(__name__)

# Pure-Python hashing — no native bcrypt build needed on Windows.
_pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

_JWT_ALG = "HS256"
_JWT_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        # Dev fallback. Set JWT_SECRET in production so tokens survive restarts.
        logger.warning("JWT_SECRET not set; using an insecure dev default.")
        return "docmind-dev-secret-change-me"
    return secret


_DB_PATH = config.data_dir / "users.db"
_db_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _db_lock, _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    REAL NOT NULL
            )
            """
        )
        # Migration: add the encrypted Groq-key column to pre-existing databases.
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
        if "groq_api_key_enc" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN groq_api_key_enc TEXT")
        conn.commit()


@dataclass
class User:
    id: str
    email: str


class AuthError(Exception):
    """Raised on invalid credentials or duplicate registration."""


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def create_user(email: str, password: str) -> User:
    email = _normalize_email(email)
    if not email or "@" not in email:
        raise AuthError("Please enter a valid email address.")
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters.")

    user_id = uuid.uuid4().hex
    password_hash = _pwd.hash(password)
    try:
        with _db_lock, _connect() as conn:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, created_at) "
                "VALUES (?, ?, ?, ?)",
                (user_id, email, password_hash, time.time()),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        raise AuthError("An account with that email already exists.")
    return User(id=user_id, email=email)


def authenticate(email: str, password: str) -> User:
    email = _normalize_email(email)
    with _db_lock, _connect() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()
    if row is None or not _pwd.verify(password, row["password_hash"]):
        raise AuthError("Invalid email or password.")
    return User(id=row["id"], email=row["email"])


def get_user(user_id: str) -> Optional[User]:
    with _db_lock, _connect() as conn:
        row = conn.execute(
            "SELECT id, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return User(id=row["id"], email=row["email"]) if row else None


def issue_token(user: User) -> str:
    now = int(time.time())
    payload = {"sub": user.id, "email": user.email, "iat": now,
               "exp": now + _JWT_TTL_SECONDS}
    return jwt.encode(payload, _jwt_secret(), algorithm=_JWT_ALG)


def decode_token(token: str) -> User:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[_JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise AuthError("Session expired. Please sign in again.")
    except jwt.PyJWTError:
        raise AuthError("Invalid authentication token.")
    user = get_user(payload.get("sub", ""))
    if user is None:
        raise AuthError("Account no longer exists.")
    return user


# --- Per-account Groq API key (encrypted at rest) ---

def set_groq_key(user_id: str, api_key: str) -> None:
    """Store the user's Groq key, encrypted. Empty input clears it."""
    enc = encrypt(api_key.strip()) if api_key and api_key.strip() else None
    with _db_lock, _connect() as conn:
        conn.execute(
            "UPDATE users SET groq_api_key_enc = ? WHERE id = ?", (enc, user_id)
        )
        conn.commit()


def get_groq_key(user_id: str) -> Optional[str]:
    """Return the user's decrypted Groq key, or None if unset/undecryptable."""
    with _db_lock, _connect() as conn:
        row = conn.execute(
            "SELECT groq_api_key_enc FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return decrypt(row["groq_api_key_enc"]) if row else None


def clear_groq_key(user_id: str) -> None:
    with _db_lock, _connect() as conn:
        conn.execute(
            "UPDATE users SET groq_api_key_enc = NULL WHERE id = ?", (user_id,)
        )
        conn.commit()


def has_groq_key(user_id: str) -> bool:
    return get_groq_key(user_id) is not None
