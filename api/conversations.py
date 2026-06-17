"""Per-account conversation persistence (chat transcripts that live forever).

Conversations, their messages, and the names of files ingested into them are
stored in the same SQLite database as users. A conversation's ``id`` doubles as
the docmind ``session_id`` (1:1), so the Chroma collection ``session-{id}`` and
the saved transcript stay keyed together with no extra mapping.

Document *vectors* are ephemeral (cleaned up on the session TTL); the transcript
here is permanent, so reopening an old chat always restores the conversation
even after its documents have expired.
"""
from __future__ import annotations

import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from docmind.config import config

_DB_PATH = config.data_dir / "users.db"
_db_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_conversations_db() -> None:
    with _db_lock, _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                title      TEXT NOT NULL DEFAULT 'New chat',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id              TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role            TEXT NOT NULL,
                content         TEXT NOT NULL,
                created_at      REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversation_files (
                conversation_id TEXT NOT NULL,
                filename        TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id)"
        )
        conn.commit()


@dataclass
class Message:
    role: str
    content: str


@dataclass
class Conversation:
    id: str
    title: str
    created_at: float
    updated_at: float
    messages: List[Message] = field(default_factory=list)
    files: List[str] = field(default_factory=list)


def create_conversation(user_id: str) -> Conversation:
    now = time.time()
    conv_id = uuid.uuid4().hex
    with _db_lock, _connect() as conn:
        conn.execute(
            "INSERT INTO conversations (id, user_id, title, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (conv_id, user_id, "New chat", now, now),
        )
        conn.commit()
    return Conversation(id=conv_id, title="New chat", created_at=now, updated_at=now)


def list_conversations(user_id: str) -> List[Conversation]:
    with _db_lock, _connect() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations "
            "WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    return [
        Conversation(
            id=r["id"], title=r["title"],
            created_at=r["created_at"], updated_at=r["updated_at"],
        )
        for r in rows
    ]


def _owns(conn: sqlite3.Connection, user_id: str, conv_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM conversations WHERE id = ? AND user_id = ?",
        (conv_id, user_id),
    ).fetchone()
    return row is not None


def get_conversation(user_id: str, conv_id: str) -> Optional[Conversation]:
    """Full conversation (messages + files), ownership-checked. None if not owned."""
    with _db_lock, _connect() as conn:
        head = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations "
            "WHERE id = ? AND user_id = ?",
            (conv_id, user_id),
        ).fetchone()
        if head is None:
            return None
        msgs = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? "
            "ORDER BY created_at ASC",
            (conv_id,),
        ).fetchall()
        files = conn.execute(
            "SELECT DISTINCT filename FROM conversation_files WHERE conversation_id = ?",
            (conv_id,),
        ).fetchall()
    return Conversation(
        id=head["id"], title=head["title"],
        created_at=head["created_at"], updated_at=head["updated_at"],
        messages=[Message(role=m["role"], content=m["content"]) for m in msgs],
        files=[f["filename"] for f in files],
    )


def owns(user_id: str, conv_id: str) -> bool:
    with _db_lock, _connect() as conn:
        return _owns(conn, user_id, conv_id)


def get_messages(conv_id: str) -> List[Message]:
    with _db_lock, _connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? "
            "ORDER BY created_at ASC",
            (conv_id,),
        ).fetchall()
    return [Message(role=r["role"], content=r["content"]) for r in rows]


def add_message(conv_id: str, role: str, content: str) -> None:
    with _db_lock, _connect() as conn:
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (uuid.uuid4().hex, conv_id, role, content, time.time()),
        )
        conn.commit()


def message_count(conv_id: str) -> int:
    with _db_lock, _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?",
            (conv_id,),
        ).fetchone()
    return int(row["n"])


def add_files(conv_id: str, names: List[str]) -> None:
    if not names:
        return
    with _db_lock, _connect() as conn:
        existing = {
            r["filename"]
            for r in conn.execute(
                "SELECT filename FROM conversation_files WHERE conversation_id = ?",
                (conv_id,),
            )
        }
        for name in names:
            if name not in existing:
                conn.execute(
                    "INSERT INTO conversation_files (conversation_id, filename) "
                    "VALUES (?, ?)",
                    (conv_id, name),
                )
        conn.commit()


def remove_file(conv_id: str, filename: str) -> None:
    with _db_lock, _connect() as conn:
        conn.execute(
            "DELETE FROM conversation_files WHERE conversation_id = ? AND filename = ?",
            (conv_id, filename),
        )
        conn.commit()


def get_files(conv_id: str) -> List[str]:
    with _db_lock, _connect() as conn:
        rows = conn.execute(
            "SELECT DISTINCT filename FROM conversation_files WHERE conversation_id = ?",
            (conv_id,),
        ).fetchall()
    return [r["filename"] for r in rows]


def set_title(conv_id: str, title: str) -> None:
    with _db_lock, _connect() as conn:
        conn.execute(
            "UPDATE conversations SET title = ? WHERE id = ?",
            (title.strip()[:80] or "New chat", conv_id),
        )
        conn.commit()


def rename_conversation(user_id: str, conv_id: str, title: str) -> bool:
    with _db_lock, _connect() as conn:
        if not _owns(conn, user_id, conv_id):
            return False
        conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title.strip()[:80] or "New chat", time.time(), conv_id),
        )
        conn.commit()
    return True


def touch(conv_id: str) -> None:
    with _db_lock, _connect() as conn:
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (time.time(), conv_id),
        )
        conn.commit()


def delete_conversation(user_id: str, conv_id: str) -> bool:
    with _db_lock, _connect() as conn:
        if not _owns(conn, user_id, conv_id):
            return False
        conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
        conn.execute(
            "DELETE FROM conversation_files WHERE conversation_id = ?", (conv_id,)
        )
        conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        conn.commit()
    return True


def latest_empty_conversation(user_id: str) -> Optional[Conversation]:
    """The user's newest conversation that has no messages yet, if any.

    Used so repeatedly hitting "New chat" reuses a blank conversation instead of
    piling up empties.
    """
    with _db_lock, _connect() as conn:
        row = conn.execute(
            """
            SELECT c.id, c.title, c.created_at, c.updated_at
            FROM conversations c
            LEFT JOIN messages m ON m.conversation_id = c.id
            WHERE c.user_id = ?
            GROUP BY c.id
            HAVING COUNT(m.id) = 0
            ORDER BY c.updated_at DESC
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    return Conversation(
        id=row["id"], title=row["title"],
        created_at=row["created_at"], updated_at=row["updated_at"],
    )
