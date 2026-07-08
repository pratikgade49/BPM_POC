"""Auth route handlers: register, login, refresh, me."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user
from app.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.users_repo import create_user, get_user_by_email, get_user_by_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> dict:
    if get_user_by_email(payload.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    # Self-registrations must be admin-approved before login.
    user = create_user(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=False,
    )

    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> dict:
    user = get_user_by_email(payload.email)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    return {
        "access_token": create_access_token(str(user["id"]), user["role"]),
        "refresh_token": create_refresh_token(str(user["id"]), user["role"]),
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest) -> dict:
    token_data = decode_token(payload.refresh_token)
    if token_data is None or token_data.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    user = get_user_by_id(token_data["sub"])
    if user is None or not user["is_active"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    return {
        "access_token": create_access_token(str(user["id"]), user["role"]),
        "refresh_token": create_refresh_token(str(user["id"]), user["role"]),
    }


@router.get("/me", response_model=UserResponse)
def me(user: dict = Depends(get_current_user)) -> dict:
    return user
