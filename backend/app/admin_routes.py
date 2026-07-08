"""Admin-only routes: list users, change roles, activate/deactivate."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import require_role
from app.schemas import UpdateRoleRequest, UserResponse
from app.users_repo import get_user_by_id, list_users, set_user_active, update_user_role

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


@router.get("/users", response_model=list[UserResponse])
def get_all_users() -> list[dict]:
    return list_users()


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def change_user_role(user_id: str, payload: UpdateRoleRequest) -> dict:
    if get_user_by_id(user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return update_user_role(user_id, payload.role)


@router.patch("/users/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(user_id: str) -> dict:
    if get_user_by_id(user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return set_user_active(user_id, is_active=False)


@router.patch("/users/{user_id}/activate", response_model=UserResponse)
def activate_user(user_id: str) -> dict:
    if get_user_by_id(user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return set_user_active(user_id, is_active=True)
