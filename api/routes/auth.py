"""Auth routes: signup, login, and current-user lookup."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import AuthError, authenticate, create_user, issue_token
from ..auth import User as DbUser
from ..deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


@router.post("/signup", response_model=AuthOut)
def signup(body: Credentials) -> AuthOut:
    try:
        user = create_user(body.email, body.password)
    except AuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AuthOut(token=issue_token(user), user=UserOut(id=user.id, email=user.email))


@router.post("/login", response_model=AuthOut)
def login(body: Credentials) -> AuthOut:
    try:
        user = authenticate(body.email, body.password)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return AuthOut(token=issue_token(user), user=UserOut(id=user.id, email=user.email))


@router.get("/me", response_model=UserOut)
def me(user: DbUser = Depends(get_current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email)
