"""Plain functions for reading/writing the users table."""
from typing import Any

from app.db import execute_returning, fetch_all, fetch_one


def create_user(
    email: str,
    password_hash: str,
    full_name: str | None,
    role: str,
    *,
    is_active: bool = False,
) -> dict[str, Any]:
    return execute_returning(
        """
        INSERT INTO users (email, password_hash, full_name, role, is_active)
        VALUES (%(email)s, %(password_hash)s, %(full_name)s, %(role)s, %(is_active)s)
        RETURNING id, email, full_name, role, is_active, created_at
        """,
        {
            "email": email,
            "password_hash": password_hash,
            "full_name": full_name,
            "role": role,
            "is_active": is_active,
        },
    )



def get_user_by_email(email: str) -> dict[str, Any] | None:
    return fetch_one("SELECT * FROM users WHERE email = %(email)s", {"email": email})


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    return fetch_one("SELECT * FROM users WHERE id = %(id)s", {"id": user_id})


def list_users() -> list[dict[str, Any]]:
    return fetch_all(
        "SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at"
    )


def update_user_role(user_id: str, role: str) -> dict[str, Any] | None:
    return execute_returning(
        """
        UPDATE users SET role = %(role)s, updated_at = now()
        WHERE id = %(id)s
        RETURNING id, email, full_name, role, is_active, created_at
        """,
        {"id": user_id, "role": role},
    )


def set_user_active(user_id: str, is_active: bool) -> dict[str, Any] | None:
    return execute_returning(
        """
        UPDATE users SET is_active = %(is_active)s, updated_at = now()
        WHERE id = %(id)s
        RETURNING id, email, full_name, role, is_active, created_at
        """,
        {"id": user_id, "is_active": is_active},
    )
