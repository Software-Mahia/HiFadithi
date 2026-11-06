# HiFadithi: instructions for coding agents (Claude Code, Codex)

Internal tool for National Museums of Kenya (NMK) researchers. A researcher photographs an
artefact (4 guided shots), Meshy AI makes a 3D draft, the researcher verifies it against the
real object, and a curator approves it. NMK staff only, no public pages.
Team: Software Mahia. Round 3 is Monday 9 Nov 2026.

## Stack
- Backend: Django + Django REST Framework + simplejwt, in `backend/`.
- Supabase is ONLY the hosted Postgres database and S3-compatible file storage.
  Do not use Supabase migrations, Edge Functions, row-level security, Cron or Auth.
- Background work: no worker process (Render free plan). The Meshy webhook, a cron-job.org call
  to the poll URL every 10 minutes and the job page finish jobs. django-q2 is installed but unused.
- Python 3.12 everywhere (CI and Render use 3.12; Django 5.1 does not support 3.14).
- 3D: Meshy (real) or FakeEngine (default in development).
- The mobile app (Expo) lives in `mobile/` and comes later.

## Commands (run from `backend/`, virtualenv active)
- `python manage.py runserver`
- `pytest`
- `ruff check .`
- `python manage.py makemigrations --check`   (CI runs this; it must report no changes)

## Who owns what (edit only your own area)
- A: `accounts/`, `access/`, `config/`, `core/permissions.py`, `core/errors.py`, CI
- B: `artefacts/`, `core/storage.py`, `scripts/backup.sh`, `scripts/restore.sh`
- C: `pipeline/`, deployment
- D: `workflow/`, `audit/`, `narration/`

## Rules
1. Work only in your own app. A change in someone else's app needs its owner's review (CODEOWNERS).
2. Run `makemigrations` only for your own app and commit the migration files.
   Never regenerate `accounts/migrations/0001_initial.py`.
3. Never write `review_status`, `is_current` or `collection_status` directly.
   Always call `transition_model()` (workflow app).
4. Only C spends real Meshy credits. Development uses FakeEngine.
5. Secrets live only in `.env` (never committed). `.env.example` holds placeholders only.
6. Every endpoint uses a permission class from `core/permissions.py`, and every artefact query
   goes through `visible_artefacts(user)`.
7. API errors use the shape `{"error": {"code": "...", "message": "..."}}` (`core/errors.py`).
8. Function names and inputs agreed between people are in `docs/seams.md`.
   Change them only after telling the people who use them.
9. Development uses a local Postgres (`DATABASE_URL` in `.env`). Only the deployed server uses
   Supabase, through the connection pooler in session mode with `sslmode=require`.
   Migrations run on the deployed database only from the deploy step.
10. Merge to develop only when CI passes (ruff, makemigrations --check, pytest). Production deploys from prod.
11. Wording: a model is an "AI-assisted 3D model", never a "scan".
12. Never paste NMK photos, narrator data or real keys into any AI tool, issue or pull request.

## How to work
- Run `pytest` and `ruff check .` before saying a task is done.
- Keep diffs small and explain what changed and why.
- Ask before adding a dependency to `requirements.txt` (changes go through a pull request).
- Do not edit `.env`.
