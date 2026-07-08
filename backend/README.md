# Process Studio Backend

FastAPI + PostgreSQL backend for the BPM Process Studio frontend.
Function-based throughout (route handlers, repo/query functions, security
helpers) - no ORM model classes, no service classes.

## Setup

1. Create a virtual environment and install dependencies:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate      # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and adjust values (DB credentials, JWT
   secret, bootstrap admin email/password):

   ```bash
   cp .env.example .env
   ```

3. Make sure PostgreSQL is running and reachable via `POSTGRES_ADMIN_DSN`
   in `.env` (any DB you already have login access to, e.g. the default
   `postgres` database - it's only used to issue `CREATE DATABASE`).

4. Run the automated setup script. This creates the application database
   (if it doesn't exist), all tables, and a bootstrap admin user - fully
   in code, no manual SQL needed:

   ```bash
   python -m scripts.init_db
   ```

   Re-running this script is safe: it skips creation steps that already
   exist.

5. Start the API:

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

   Docs available at `http://localhost:8000/docs`.

## Auth flow

- `POST /auth/login` with email/password -> returns `access_token` +
  `refresh_token`.
- Send `Authorization: Bearer <access_token>` on subsequent requests.
- `POST /auth/refresh` with a `refresh_token` to get a new pair once the
  access token expires.

## Roles

- **viewer** - can list/view processes only.
- **editor** - can create processes, and update/delete processes they own.
- **admin** - full access to all processes, plus `/admin/users` endpoints
  to manage roles and activation status.

New self-registrations via `POST /auth/register` default to `viewer`
unless you choose to lock that endpoint down further (e.g. restrict it to
admins only by adding `Depends(require_role("admin"))` to it) - decide
based on whether you want open sign-up or admin-provisioned accounts only.

## Project layout

```
backend/
  app/
    main.py            FastAPI app + router registration
    config.py           Settings loaded from .env
    db.py                Connection pool + fetch/execute helpers
    schema_sql.py        Raw DDL used by scripts/init_db.py
    security.py          Password hashing + JWT helpers
    deps.py              get_current_user, require_role(...)
    schemas.py           Pydantic request/response models
    users_repo.py        User queries
    processes_repo.py    Process + version-history queries
    auth_routes.py       /auth/*
    process_routes.py    /processes/*
    admin_routes.py       /admin/*
  scripts/
    init_db.py           Automated DB + table creation
  requirements.txt
  .env.example
```
