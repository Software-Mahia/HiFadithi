# VERIFICATION — Person A

Evidence from this branch (`feat/person-a`), sqlite unless noted. Run from `backend/`:
`../.venv/Scripts/python.exe -m pytest`, `ruff check .`, `makemigrations --check`.

State at verification: full suite **pass** (3 skipped = D's Postgres-only guard tests),
`ruff` clean, `makemigrations --check` clean, `manage.py check` 0 issues. Live server smoke:
`me` unauth → 401 shared shape; `/api/auth/token/` → 200; `me` with token → 200 role admin;
`/admin/login/` → 200.

| Card A requirement | Status | Evidence |
|---|---|---|
| Custom `User` with roles | MET | `accounts/models.py`; `accounts/tests/test_user.py`, `test_roles.py` |
| Permission classes IsResearcher/IsCurator/IsAdmin | MET | `core/permissions.py`; enforced in every A view |
| One error shape `{"error":{code,message}}` | MET | `core/errors.py`; asserted in all A API tests + live 401 |
| Access rules per table (RLS → queryset filtering) | MET (access) | `access.selectors.visible_artefacts`; `access/tests/test_visible_artefacts.py` |
| Restricted object never shown without access | MET | leak + role + admin-not-exempt tests pass |
| Sign-in | MET | SimpleJWT `/api/auth/token/`; `accounts/tests/test_auth_api.py` + live |
| Invite staff | MET (acceptance deferred) | `/api/accounts/invite/`; `test_invite_api.py`. Invited account has unusable password until a set-password step (BLOCKERS #3) |
| Change role (nobody changes own role) | MET | `/api/accounts/<id>/role/`; `test_role_change_api.py` incl. self-change 403 |
| Deactivate staff (loses access now) | MET | `/api/accounts/<id>/deactivate/` + admin action; `test_invite_api.py`, `test_admin_actions.py` |
| Admin screens call services, not raw field edits | MET | `accounts/admin.py` deactivate action via `core.admin.service_action`; status fields read-only via `ProtectedStatusAdminMixin` |
| pytest access/role tests pass in CI | MET (locally) | CI runs pytest against Postgres service; confirm on CI run |
| CI: ruff, makemigrations --check, pytest (Postgres), secret scan | MET | `.github/workflows/ci.yml` (backend + gitleaks jobs); gitleaks not run locally (BLOCKERS #9) |
| Project scaffolding: settings read `DATABASE_URL`, `.env.example`, local Postgres, README | MET | `config/settings/base.py`; `.env.example`; `docker-compose.yml`; `README.md` |
| Collection list shows only permitted | PARTIAL | backend `visible_artefacts` ready; the screen is front end (deferred, separate branch) |
| App shell + shared components on every screen | PARTIAL | mobile app shell on `a/align-mobile-layout` (out of this scope) |
| `remove_capture_photos` deletes photos + Meshy task + logged | NOT MET (deferred) | stub; blocked on B `core.storage` delete helper (C engine delete exists) — placeholders.md, BLOCKERS #7 |
| `delete_person_data` | NOT MET (owner open) | stub; touches D's `narration` data — DECISIONS.md, BLOCKERS #4 |
| Audit trigger attached to every table | N/A to A | `audit`/`log_audit` is D's in the current tree (was A in blueprint) |

## Demo path A is responsible for (Mon 9 Nov, Django admin)
- **Admin signs in to Django admin:** verified (`/admin/login/` 200; superuser with role=admin).
- **Access rules hold:** `visible_artefacts` hides restricted objects from users without a grant (tested).
- **verifier ≠ approver, and no direct status write:** these are **D's** `transition_model()` + guard.
  The guard tests are Postgres-only and skipped on sqlite; A only reads status. Depends on D +
  a Postgres run (BLOCKERS #1).

## Chain parts that depend on B/C/D (stubbed — see docs/placeholders.md)
B: `search_artefacts`, seed data, `core.storage` delete helper. C: engine (real `delete` exists).
D: `transition_model`, `log_audit`, `narration.Story`/`Consent`.
