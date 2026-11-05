# PLAN — Person A (feat/person-a)

Scope: only A's areas (`accounts`, `access`, `core`, `config`, A scaffolding, CI, docs).
Each stage has a goal, the files it touches, and a runnable "done when" check.
Back end due Sat 7 Nov; Round 3 demo Mon 9 Nov on Django admin.

Run checks from `backend/` with the venv: `../.venv/Scripts/python.exe -m pytest`, `../.venv/Scripts/ruff.exe check .`, `../.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`.

| # | Stage | Files | Done when | Status |
|---|---|---|---|---|
| 1 | Foundations: custom `User` + roles | `accounts/models.py`, `accounts/migrations/0001_initial.py` | `pytest accounts/tests/test_user.py` green | DONE |
| 2 | Permissions + error shape | `core/permissions.py`, `core/errors.py` | role classes + `{"error":{code,message}}` used by API tests | DONE |
| 3 | Access: `ArtefactAccess` + `visible_artefacts()` + restricted rule | `access/models.py`, `access/selectors.py`, `access/admin.py`, `access/migrations/0001_initial.py`, `access/tests/test_visible_artefacts.py` | `pytest access` green; restricted hidden without grant; no role exempt | DONE |
| 4 | Auth API: invite-staff, me, deactivate | `accounts/{services,serializers,views,urls}.py`, `accounts/tests/test_{invite,me}_api.py` | `pytest accounts` green; 403/409/422/401 shapes correct | DONE |
| 5 | Role change (admin only; nobody changes own role) | `accounts/{services,serializers,views,urls}.py`, `accounts/tests/test_role_change_api.py` | admin can set another user's role; self-change and non-admin refused | TODO |
| 6 | Admin service actions | `accounts/admin.py`, `access/admin.py` | a "deactivate" admin action calls the service (not a raw field edit) | TODO |
| 7 | Scaffolding: local Postgres + CI secret scan | `docker-compose.yml`, `.github/workflows/ci.yml`, `.env.example` | `docker compose up -d db` starts Postgres; CI has a gitleaks job | TODO |
| 8 | Deferred A services behind interfaces (stubs) | `access/services.py`, `docs/placeholders.md`, `BLOCKERS.md` | `delete_person_data`/`remove_capture_photos` documented stubs; deps recorded | TODO |
| 9 | Docs + verification | `README.md`, `DECISIONS.md`, `VERIFICATION.md` | README clone-to-running; Card A requirements walked | TODO |

Stubbed cross-slice deps (never implement — see `docs/placeholders.md`): B `search_artefacts()` and a `core.storage` delete helper; C `pipeline.engines.get_engine().delete()` (real interface exists); D `transition_model()`, `log_audit()`, `narration` `Story`/`Consent`.
