# BLOCKERS — Person A

Priority order. What blocks A, and what someone else (or the owner, Joylynn) must provide.

## For the Mon 9 Nov demo
1. **D: `transition_model()` + guard real on Postgres.** The guard tests are skipped on
   sqlite ("database trigger is Postgres only"). The verifier≠approver and no-direct-status-write
   rules are D's; A only reads status. Needs D + a Postgres run to prove in the demo.
2. **B: seed data (`seed_demo`).** A's access rules and the Django-admin demo are easier to show
   with one user per role and artefacts in different states. B owns `seed_demo`.
3. **Sign-in acceptance flow.** Invited accounts have an unusable password and cannot sign in yet.
   For the demo, admin/superuser accounts (made via `createsuperuser`/`setup_roles`) sign in to
   Django admin. A set-password/accept-invite endpoint is still needed for invited staff.

## Needs Joylynn (keys / accounts / decisions)
4. **`delete_person_data()` ownership** — confirm A vs D (see `DECISIONS.md`). If A keeps it, it
   can only be built once D's `narration.Story`/`Consent` and `log_audit()` exist.
5. **Supabase Postgres + Storage keys** for staging/production (`.env`): `DATABASE_URL` (session
   pooler), `SUPABASE_S3_*`. Not needed for local dev (sqlite/local Postgres).
6. **Meshy keys** (owner C) — not A's, listed for completeness; development uses the fake engine.

## B/C gaps A cannot work around
7. **B: `core.storage` delete helper** (`delete_object(bucket, path)`) — required before
   `remove_capture_photos` can delete capture files. C's engine `delete` already exists.

## Docs
8. `docs/blueprint.md` and `docs/django-addendum.md` referenced by the brief do not exist. The
   blueprint is at `.tools/scan/HiFadithi_Build_Blueprint_and_Work_Split (3).md`; the Django
   addendum is effectively the merged root `AGENTS.md`. Consider moving/symlinking into `docs/`.
