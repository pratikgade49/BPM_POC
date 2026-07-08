"""One-shot setup script: creates the database (if missing), all tables,
and a bootstrap admin user - fully automated, no manual SQL required.

Run with:  python -m scripts.init_db
"""
import sys
from pathlib import Path

# Allow running as `python -m scripts.init_db` from the backend/ directory.
sys.path.append(str(Path(__file__).resolve().parent.parent))

import psycopg

from app.config import get_settings
from app.schema_sql import SCHEMA_SQL
from app.security import hash_password


def database_exists(admin_dsn: str, database_name: str) -> bool:
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        row = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (database_name,)
        ).fetchone()
        return row is not None


def create_database(admin_dsn: str, database_name: str) -> None:
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{database_name}"')
    print(f"Created database '{database_name}'")


def create_tables(database_url: str) -> None:
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute(SCHEMA_SQL)
    print("Tables created / verified")


def create_bootstrap_admin(database_url: str, email: str, password: str) -> None:
    with psycopg.connect(database_url, autocommit=True, row_factory=psycopg.rows.dict_row) as conn:
        existing = conn.execute("SELECT 1 FROM users WHERE email = %s", (email,)).fetchone()
        if existing:
            print(f"Admin user '{email}' already exists - skipping")
            return
        conn.execute(
            """
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (%s, %s, %s, 'admin')
            """,
            (email, hash_password(password), "Bootstrap Admin"),
        )
    print(f"Created bootstrap admin user '{email}'")


def main() -> None:
    settings = get_settings()

    if not database_exists(settings.postgres_admin_dsn, settings.database_name):
        create_database(settings.postgres_admin_dsn, settings.database_name)
    else:
        print(f"Database '{settings.database_name}' already exists - skipping creation")

    create_tables(settings.database_url)
    create_bootstrap_admin(
        settings.database_url, settings.bootstrap_admin_email, settings.bootstrap_admin_password
    )
    print("Database initialization complete.")


if __name__ == "__main__":
    main()
