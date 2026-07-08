"""Database access layer - plain functions over a psycopg connection pool.

No ORM models. Callers pass SQL + params and get back rows as dicts.
"""
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: ConnectionPool | None = None


def init_pool() -> ConnectionPool:
    """Create (once) and return the global connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    """Borrow a connection from the pool for the duration of the `with` block."""
    pool = init_pool()
    with pool.connection() as conn:
        yield conn


def fetch_one(sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
    with get_connection() as conn:
        cur = conn.execute(sql, params)
        return cur.fetchone()


def fetch_all(sql: str, params: tuple | dict = ()) -> list[dict[str, Any]]:
    with get_connection() as conn:
        cur = conn.execute(sql, params)
        return cur.fetchall()


def execute(sql: str, params: tuple | dict = ()) -> None:
    """Run a statement that doesn't return rows (INSERT/UPDATE/DELETE without RETURNING)."""
    with get_connection() as conn:
        conn.execute(sql, params)
        conn.commit()


def execute_returning(sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
    """Run an INSERT/UPDATE/DELETE ... RETURNING ... and return the single resulting row."""
    with get_connection() as conn:
        cur = conn.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
        return row
