"""Per-account conversation CRUD + session rehydration."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from docmind.session import Session, session_manager

from .. import conversations as store
from ..auth import User
from ..deps import get_current_user

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


class ConversationSummary(BaseModel):
    id: str
    title: str
    updated_at: float


class MessageOut(BaseModel):
    role: str
    content: str


class ConversationDetail(BaseModel):
    id: str
    title: str
    messages: List[MessageOut]
    files: List[str]


class RenameIn(BaseModel):
    title: str


def _rehydrate(session: Session, conv: store.Conversation) -> None:
    """Restore a cold in-memory Session from persisted state.

    Chat history is always restorable (it lives in SQLite). Document retrieval is
    only restorable while the Chroma vectors are still on disk (they expire on the
    session TTL); if they're gone, the transcript still loads and grounded Q&A
    simply needs a re-upload.
    """
    if not session.history and conv.messages:
        session.history = [
            {"role": m.role, "content": m.content} for m in conv.messages
        ]
    try:
        if session.store.count() > 0 and not session.ingested_files:
            from docmind.keyword_index import KeywordIndex

            session.keyword_index = KeywordIndex(session.store.all_documents())
            session.ingested_files = list(conv.files)
    except Exception:  # noqa: BLE001 — rehydration is best-effort
        pass


@router.get("", response_model=List[ConversationSummary])
def list_conversations(user: User = Depends(get_current_user)) -> List[ConversationSummary]:
    return [
        ConversationSummary(id=c.id, title=c.title, updated_at=c.updated_at)
        for c in store.list_conversations(user.id)
    ]


@router.post("", response_model=ConversationSummary)
def create_conversation(user: User = Depends(get_current_user)) -> ConversationSummary:
    # Reuse an existing blank conversation instead of stacking empties.
    conv = store.latest_empty_conversation(user.id) or store.create_conversation(user.id)
    session_manager.get_or_create(conv.id)
    return ConversationSummary(id=conv.id, title=conv.title, updated_at=conv.updated_at)


@router.get("/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: str, user: User = Depends(get_current_user)
) -> ConversationDetail:
    conv = store.get_conversation(user.id, conv_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    session = session_manager.get_or_create(conv_id)
    _rehydrate(session, conv)
    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        messages=[MessageOut(role=m.role, content=m.content) for m in conv.messages],
        files=conv.files,
    )


@router.patch("/{conv_id}", response_model=ConversationSummary)
def rename_conversation(
    conv_id: str, body: RenameIn, user: User = Depends(get_current_user)
) -> ConversationSummary:
    if not store.rename_conversation(user.id, conv_id, body.title):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conv = store.get_conversation(user.id, conv_id)
    assert conv is not None
    return ConversationSummary(id=conv.id, title=conv.title, updated_at=conv.updated_at)


@router.delete("/{conv_id}")
def delete_conversation(
    conv_id: str, user: User = Depends(get_current_user)
) -> dict[str, bool]:
    if not store.delete_conversation(user.id, conv_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    # Drop the live session + its Chroma collection / uploads.
    session_manager.end_session(conv_id)
    return {"ok": True}
