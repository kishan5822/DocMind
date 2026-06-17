"""Shared FastAPI dependencies: bearer-token auth and session resolution."""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from docmind.session import Session, session_manager

from .auth import AuthError, User, decode_token


def get_current_user(
    authorization: str | None = Header(default=None),
) -> User:
    """Resolve the authenticated user from the `Authorization: Bearer` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_token(token)
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)
        )


def get_session(session_id: str, _user: User = Depends(get_current_user)) -> Session:
    """Return the live Session for a given id, creating it if needed.

    Sessions are ephemeral (TTL-cleaned), mirroring the Streamlit app's model.
    Auth is required, but for v1 a session id is not bound to a specific user.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id.")
    return session_manager.get_or_create(session_id)
