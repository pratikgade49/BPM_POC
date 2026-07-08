"""FastAPI dependencies: token parsing, current-user resolution, role gating.

These are plain functions (and function factories) used with `Depends(...)`,
not classes - keeps the RBAC logic composable and easy to test in isolation.
"""
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import decode_token
from app.users_repo import get_user_by_id

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = get_user_by_id(payload["sub"])
    if user is None or not user["is_active"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    return user


def require_role(*allowed_roles: str):
    """Dependency factory: require the current user to have one of the given roles.

    Usage: Depends(require_role("admin", "editor"))
    """

    def _check(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires one of roles: {', '.join(allowed_roles)}",
            )
        return user

    return _check
