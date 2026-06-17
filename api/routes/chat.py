"""Model list and streaming chat routes."""
from __future__ import annotations

import json
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from docmind.llm import available_models, fetch_models_from_api
from docmind.session import session_manager

from .. import conversations as convo_store
from ..auth import User, get_groq_key
from ..deps import get_current_user

router = APIRouter(prefix="/api", tags=["chat"])

# Per-user cache for the Groq model list (the live list depends on the user's key).
_models_cache: dict[str, dict] = {}
_MODELS_TTL = 300


class ModelsOut(BaseModel):
    models: List[str]


class ChatIn(BaseModel):
    session_id: str
    message: str
    model: str


@router.get("/models", response_model=ModelsOut)
def models(user: User = Depends(get_current_user)) -> ModelsOut:
    # Use the account's own key for the live list; show the static fallback list
    # (no network, no shared key) until the user has set one.
    key = get_groq_key(user.id)
    if not key:
        return ModelsOut(models=available_models())
    now = time.time()
    cached = _models_cache.get(user.id)
    if not cached or now - cached["at"] > _MODELS_TTL:
        cached = {"at": now, "models": fetch_models_from_api(key)}
        _models_cache[user.id] = cached
    return ModelsOut(models=list(cached["models"]))


@router.post("/chat")
def chat(body: ChatIn, user: User = Depends(get_current_user)) -> StreamingResponse:
    """Stream a grounded answer as Server-Sent Events.

    Each delta is JSON-encoded so whitespace/newlines survive SSE framing.
    The stream ends with a literal `data: [DONE]` frame. The completed turn is
    persisted to the conversation transcript after a successful stream.
    """
    conv_id = body.session_id
    if not convo_store.owns(user.id, conv_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")

    key = get_groq_key(user.id)
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Add your Groq API key in Settings to start chatting.",
        )

    session = session_manager.get_or_create(conv_id)
    question = body.message
    is_first = convo_store.message_count(conv_id) == 0

    def event_stream():
        parts: List[str] = []
        try:
            for delta in session.ask(question, body.model, key):
                parts.append(delta)
                yield f"data: {json.dumps(delta)}\n\n"
        except Exception as exc:  # noqa: BLE001 — surface a friendly message
            msg = "\n\n_Sorry — something went wrong generating that answer._"
            parts.append(msg)
            yield f"data: {json.dumps(msg)}\n\n"
            from docmind.logging_config import get_logger

            get_logger(__name__).exception("Chat stream failed: %s", exc)
        finally:
            # Persist the turn (transcript lives forever, independent of vectors).
            answer = "".join(parts).strip()
            if question.strip():
                convo_store.add_message(conv_id, "user", question)
            if answer:
                convo_store.add_message(conv_id, "assistant", answer)
            if is_first and question.strip():
                convo_store.set_title(conv_id, question.strip()[:60])
            convo_store.touch(conv_id)
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
