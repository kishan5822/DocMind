"""FastAPI application factory for the DocMind web backend.

Run with:  uvicorn api.main:app --reload --port 8000
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from docmind.logging_config import get_logger

from .auth import init_db
from .conversations import init_conversations_db
from .routes import auth as auth_routes
from .routes import chat as chat_routes
from .routes import conversations as conversation_routes
from .routes import ingest as ingest_routes
from .routes import settings as settings_routes

logger = get_logger(__name__)


def _allowed_origins() -> list[str]:
    # Comma-separated override; defaults cover local Next.js dev.
    raw = os.getenv("WEB_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure the users + conversation tables exist (and run migrations).
    init_db()
    init_conversations_db()
    # Warm the embedding model + reranker so the first upload isn't slow.
    try:
        from docmind.embeddings import embed_query
        from docmind.retrieval import _get_ranker

        embed_query("warmup")
        _get_ranker()
        logger.info("Models warmed up.")
    except Exception as exc:  # noqa: BLE001 — warmup is best-effort
        logger.warning("Model warmup skipped: %s", exc)
    yield


app = FastAPI(title="DocMind API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(settings_routes.router)
app.include_router(conversation_routes.router)
app.include_router(ingest_routes.router)
app.include_router(chat_routes.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
