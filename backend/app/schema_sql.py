"""Raw DDL for the application schema.

Kept as a plain string (rather than an ORM model) so `scripts/init_db.py`
can create everything with straightforward, idempotent statements.
"""

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT,
    role            user_role NOT NULL DEFAULT 'viewer',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    bpmn_xml        TEXT NOT NULL,
    owner_id        UUID NOT NULL REFERENCES users(id),
    version         INTEGER NOT NULL DEFAULT 1,
    is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS process_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id      UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    bpmn_xml        TEXT NOT NULL,
    saved_by        UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (process_id, version)
);

CREATE INDEX IF NOT EXISTS idx_processes_owner ON processes(owner_id);
CREATE INDEX IF NOT EXISTS idx_process_versions_process ON process_versions(process_id);
"""
