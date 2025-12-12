# House FastAPI backend

This folder hosts a FastAPI + SQLModel backend that keeps Supabase as the source of truth for authentication.

## Quick start
- Create and activate a virtualenv.
- Install dependencies: `pip install -r backend/requirements.txt`.
- Copy `backend/.env.example` to `backend/.env` and fill your Supabase values (anon key for auth calls, service role key only for trusted server-side work, JWT secret for token verification).
- Run the server: `uvicorn app.main:app --reload --env-file backend/.env`.

## Endpoints
- `POST /api/v1/auth/login` — proxies email/password to Supabase GoTrue and returns the access/refresh tokens Supabase issues. Use this instead of the Next.js auth form.
- `GET /api/v1/auth/me` — decodes the Supabase JWT with `SUPABASE_JWT_SECRET` to inspect the current user.
- `GET /api/v1/health/live` — liveness probe.

## SQLModel notes
- `DATABASE_URL` should point to your Supabase Postgres (or local Postgres for development). The helper `init_models` exists but is not called automatically; rely on Supabase migrations for schema changes.
- Add new models under `app/models` and reuse `get_session` from `app/db.py` to run queries within routes.
