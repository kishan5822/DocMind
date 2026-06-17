"""Session lifecycle and document ingestion routes."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from docmind.session import session_manager
from docmind.validation import FileInput, ValidationError

from .. import conversations as convo_store
from ..auth import User
from ..deps import get_current_user

router = APIRouter(prefix="/api", tags=["documents"])


class SessionOut(BaseModel):
    session_id: str


class IngestOut(BaseModel):
    ingested: List[str]
    skipped: List[tuple[str, str]]
    chunks_added: int


class FilesOut(BaseModel):
    files: List[str]


class DeleteFileOut(BaseModel):
    filename: str
    chunks_removed: int


@router.post("/session", response_model=SessionOut)
def create_session(_user: User = Depends(get_current_user)) -> SessionOut:
    # Opportunistic cleanup of idle sessions, mirroring the Streamlit app.
    session_manager.cleanup_expired()
    session_id = session_manager.new_session_id()
    session_manager.get_or_create(session_id)
    return SessionOut(session_id=session_id)


@router.post("/ingest", response_model=IngestOut)
async def ingest(
    session_id: str = Form(...),
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
) -> IngestOut:
    if not convo_store.owns(user.id, session_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    session = session_manager.get_or_create(session_id)

    inputs: List[FileInput] = []
    for uf in files:
        data = await uf.read()
        inputs.append(FileInput(name=uf.filename or "upload", data=data))

    try:
        report = session.ingest(inputs)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Remember which files belong to this conversation (survives vector expiry).
    convo_store.add_files(session_id, report.ingested)
    convo_store.touch(session_id)

    return IngestOut(
        ingested=report.ingested,
        skipped=report.skipped,
        chunks_added=report.chunks_added,
    )


@router.delete("/ingest/file", response_model=DeleteFileOut)
def delete_ingested_file(
    session_id: str,
    filename: str,
    user: User = Depends(get_current_user),
) -> DeleteFileOut:
    if not convo_store.owns(user.id, session_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    session = session_manager.get_or_create(session_id)
    removed = session.delete_file(filename)
    convo_store.remove_file(session_id, filename)
    convo_store.touch(session_id)
    return DeleteFileOut(filename=filename, chunks_removed=removed)


@router.get("/session/files", response_model=FilesOut)
def session_files(
    session_id: str, user: User = Depends(get_current_user)
) -> FilesOut:
    if not convo_store.owns(user.id, session_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return FilesOut(files=convo_store.get_files(session_id))
