"""Session, memory, ingestion orchestration, and cleanup.

A Session owns one user's isolated state: its Chroma collection, its in-memory
BM25 index, its chat history, and its uploaded-file area — all keyed to a unique
session id. SessionManager tracks sessions and expires idle ones, cleaning up
every artifact so nothing persists permanently.
"""
from __future__ import annotations

import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterator, List, Optional, Sequence, Tuple

from .chunking import chunk_documents
from .config import config
from .embeddings import embed_documents
from .keyword_index import KeywordIndex
from .llm import stream_answer
from .logging_config import get_logger
from .parsing import ParsingError, parse_file
from .prompt import build_messages
from .retrieval import retrieve
from .validation import FileInput, ValidationError, validate_batch
from .vector_store import VectorStore

logger = get_logger(__name__)


@dataclass
class IngestReport:
    """Outcome of ingesting a batch."""

    ingested: List[str] = field(default_factory=list)        # filenames stored
    skipped: List[Tuple[str, str]] = field(default_factory=list)  # (name, reason)
    chunks_added: int = 0

    @property
    def ok(self) -> bool:
        return len(self.ingested) > 0


class Session:
    """One isolated user/session worth of state."""

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.store = VectorStore(session_id)
        self.keyword_index = KeywordIndex([])
        self.history: List[Dict[str, str]] = []
        self.ingested_files: List[str] = []
        self.last_active = time.time()
        self._upload_dir = config.data_dir / "uploads" / session_id
        self._lock = threading.Lock()

    def touch(self) -> None:
        self.last_active = time.time()

    # --- ingestion ---

    def ingest(
        self,
        files: Sequence[FileInput],
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> IngestReport:
        """Validate, parse, chunk, embed, and store a batch. Bad files skipped.

        progress_callback(current, total, message) — called after each file is
        embedded and stored so the caller can update a UI progress bar.
        """
        self.touch()
        report = IngestReport()

        batch = validate_batch(files)  # may raise ValidationError for batch limits
        for rej in batch.rejected:
            report.skipped.append((rej.name, rej.reason))

        # Parse all accepted files first (fast), collect per-file docs.
        parsed = []
        for af in batch.accepted:
            try:
                parsed.append(parse_file(af))
                self._persist(af.name, af.data)
            except ParsingError as e:
                logger.warning("Skipping '%s': %s", af.name, e)
                report.skipped.append((af.name, str(e)))

        if not parsed:
            return report

        total = len(parsed)
        # Embed and store one document at a time so the caller gets live progress.
        for i, doc in enumerate(parsed):
            chunks = chunk_documents([doc])
            if not chunks:
                report.skipped.append((doc.filename, "No chunks produced."))
                if progress_callback:
                    progress_callback(i + 1, total, f"⚠ {doc.filename}: no chunks")
                continue

            embeddings = embed_documents([c.text for c in chunks])

            with self._lock:
                self.store.add_chunks(chunks, embeddings)
            report.chunks_added += len(chunks)
            report.ingested.append(doc.filename)
            if doc.filename not in self.ingested_files:
                self.ingested_files.append(doc.filename)

            if progress_callback:
                progress_callback(i + 1, total, f"✓ {doc.filename} ({len(chunks)} chunks)")

        # Rebuild BM25 once over the full corpus after all files are stored.
        with self._lock:
            self.keyword_index = KeywordIndex(self.store.all_documents())

        return report

    def _persist(self, name: str, data: bytes) -> None:
        """Save an uploaded file to the session's isolated area."""
        try:
            self._upload_dir.mkdir(parents=True, exist_ok=True)
            (self._upload_dir / name).write_bytes(data)
        except OSError as e:
            logger.warning("Could not persist '%s': %s", name, e)

    # --- chat ---

    def ask(self, question: str, model: str) -> Iterator[str]:
        """Retrieve context, generate a grounded answer, stream it, update memory."""
        self.touch()
        question = question.strip()
        if not question:
            yield "Please enter a question."
            return

        context = retrieve(question, self.store, self.keyword_index)
        messages = build_messages(question, context, self.history)

        answer_parts: List[str] = []
        for delta in stream_answer(messages, model):
            answer_parts.append(delta)
            yield delta

        # Commit the turn to memory only after a successful stream.
        answer = "".join(answer_parts)
        self.history.append({"role": "user", "content": question})
        self.history.append({"role": "assistant", "content": answer})

    def reset_memory(self) -> None:
        """Clear chat history (kept separate from document scope)."""
        self.history.clear()

    # --- cleanup ---

    def cleanup(self) -> None:
        """Remove the collection, BM25 index, uploaded files, and memory."""
        with self._lock:
            self.store.delete()
            self.keyword_index = KeywordIndex([])
            self.history.clear()
            self.ingested_files.clear()
            if self._upload_dir.exists():
                shutil.rmtree(self._upload_dir, ignore_errors=True)
        logger.info("Cleaned up session '%s'.", self.session_id)


class SessionManager:
    """Tracks sessions and expires idle ones."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}
        self._lock = threading.Lock()

    def new_session_id(self) -> str:
        return uuid.uuid4().hex

    def get_or_create(self, session_id: str) -> Session:
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess is None:
                sess = Session(session_id)
                self._sessions[session_id] = sess
                logger.info("Created session '%s'.", session_id)
            sess.touch()
            return sess

    def end_session(self, session_id: str) -> None:
        with self._lock:
            sess = self._sessions.pop(session_id, None)
        if sess:
            sess.cleanup()

    def cleanup_expired(self) -> int:
        """Remove sessions idle longer than the TTL. Returns count cleaned."""
        ttl = config.session_ttl_minutes * 60
        now = time.time()
        expired: List[Session] = []
        with self._lock:
            for sid, sess in list(self._sessions.items()):
                if now - sess.last_active > ttl:
                    expired.append(self._sessions.pop(sid))
        # Clean up outside the manager lock to avoid holding it during IO.
        for sess in expired:
            sess.cleanup()
        if expired:
            logger.info("Expired %d idle session(s).", len(expired))
        return len(expired)


# Module-level singleton manager.
session_manager = SessionManager()
