"""Account settings: manage the per-account Groq API key (encrypted at rest)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import User, clear_groq_key, has_groq_key, set_groq_key
from ..deps import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsOut(BaseModel):
    has_groq_key: bool


class GroqKeyIn(BaseModel):
    api_key: str


def _validate_groq_key(api_key: str) -> None:
    """Reject a key Groq won't accept, so users get immediate feedback.

    A 401 means a bad key; other errors (network, etc.) are tolerated so a
    transient hiccup doesn't block saving a key the user knows is valid.
    """
    import requests

    try:
        resp = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=8,
        )
    except requests.RequestException:
        return  # Couldn't reach Groq — don't block; it'll surface on first chat.
    if resp.status_code in (401, 403):
        raise HTTPException(status_code=400, detail="That Groq API key was rejected.")


@router.get("", response_model=SettingsOut)
def get_settings(user: User = Depends(get_current_user)) -> SettingsOut:
    return SettingsOut(has_groq_key=has_groq_key(user.id))


@router.put("/groq-key", response_model=SettingsOut)
def put_groq_key(
    body: GroqKeyIn, user: User = Depends(get_current_user)
) -> SettingsOut:
    key = body.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")
    _validate_groq_key(key)
    set_groq_key(user.id, key)
    return SettingsOut(has_groq_key=True)


@router.delete("/groq-key", response_model=SettingsOut)
def delete_groq_key(user: User = Depends(get_current_user)) -> SettingsOut:
    clear_groq_key(user.id)
    return SettingsOut(has_groq_key=False)
