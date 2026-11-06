# HiFadithi

NMK's internal tool for verified 3D records of artefacts.

- `backend/`: Django + Django REST Framework. Supabase is used only as the Postgres database and file storage.
- `mobile/`: Expo app (front-end phase).

## Run the back end locally

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in your own values
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Open http://127.0.0.1:8000/admin/ to see the data.

Run tests: `pytest`. Lint: `ruff check .`. Migration check: `python manage.py makemigrations --check`.

### Local Postgres (optional; SQLite is the default)

```bash
docker compose up -d db        # Postgres 16 as container hifadithi-db, db hifadithi
# in backend/.env:
DATABASE_URL=postgres://postgres@localhost:5432/hifadithi
python manage.py migrate
```

The same container name/db is what `scripts/backup_db.sh` and `scripts/restore_drill.sh` expect.

### Accounts API (Person A)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/token/` | anyone | sign in → `{access, refresh}` |
| POST | `/api/auth/token/refresh/` | anyone | refresh the access token |
| GET | `/api/accounts/me/` | signed-in | the current user |
| POST | `/api/accounts/invite/` | admin | invite staff → `{profile_id}` |
| POST | `/api/accounts/<id>/role/` | admin | change a user's role (not your own) |
| POST | `/api/accounts/<id>/deactivate/` | admin | deactivate a user (loses access now) |

Errors use one shape: `{"error": {"code": "...", "message": "..."}}`. Restricted artefacts are
filtered by `access.selectors.visible_artefacts(user)`.

## The status guard (read this before touching statuses)

`review_status`, `is_current` (ModelVersion) and `collection_status` (Artefact) change **only**
through `workflow.services.transition_model()`. Two layers enforce it:

- **Python:** add `workflow.guard.ProtectedFieldsMixin` to the model and list the fields in
  `PROTECTED_FIELDS`. A `save()` that changes them outside `allow_status_change()` raises.
- **Database (Postgres):** D adds a migration with `guard_operations({...})` once the
  `ModelVersion` and `Artefact` models exist. It blocks every other path, including
  `QuerySet.update()` and the admin. Tests: `workflow/tests/test_guard.py`.

## Demo screens (Django admin)

Every app has an `admin.py`. Status fields are read-only (`core.admin.ProtectedStatusAdminMixin`);
buttons such as Verify and Approve are admin actions built with `core.admin.service_action()`
that call the service functions, so the demo shows the real rules.
Run `python manage.py setup_roles` after migrating: it creates the researcher, curator and admin
groups, and users join their role's group automatically.

## Who owns what

| Folder | Owner |
|---|---|
| `config/`, `core/permissions.py`, `core/errors.py`, `accounts/`, `access/` | A |
| `core/storage.py`, `artefacts/`, `scripts/` | B |
| `pipeline/`, deployment | C |
| `workflow/`, `audit/`, `narration/` | D |

Rules:
1. Only the owner creates migrations for their app (`python manage.py makemigrations <your_app>`).
2. Use another app only through its `services.py` (writes) or `selectors.py` (reads).
3. Each owner adds their app's `include()` line to `config/urls.py`.
4. Secrets live in `.env` only. Never commit `.env`.
