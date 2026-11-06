# DECISIONS — Person A

What was unclear, the choice made, why, and how to change it. Newest first.

## Stack: Django reality + addendum win over the Supabase blueprint (on *how*)
- **Unclear:** `blueprint.md` (rev 7) describes Supabase Edge Functions, row-level security (RLS) and pgTAP. The repo is Django + DRF + SimpleJWT + django-storages + django-q2.
- **Choice:** follow the Django implementation for *how* things are built; the blueprint still rules *what* the rules are (BR-1..19, lifecycle, definition of done). Concept mapping: RLS → DRF permission classes + queryset filtering (`visible_artefacts`); status guard → `save()` override / Postgres trigger in a migration (D); Edge Functions → DRF views / management commands / django-q2 tasks; pgTAP → pytest.
- **Change it:** only if the team moves back to Supabase; then revisit access + auth.
- **Note:** the brief points at `docs/blueprint.md` and `docs/django-addendum.md`, which do not exist in the tree. The blueprint lives at `.tools/scan/HiFadithi_Build_Blueprint_and_Work_Split (3).md`; the Django "addendum" is effectively the merged root `AGENTS.md`. Recorded in `BLOCKERS.md`.

## `delete_person_data()` ownership — OPEN QUESTION for Person A to resolve
- **Unclear:** blueprint rev 7 assigns narrator deletion to **D** because it deletes D's `Story`/`Consent` data. The current tree has the stub in **`access/services.py` (A)**, and seam S9 lists it under D while A owns `remove_capture_photos`.
- **Choice:** leave the stub where it is (A) for now, but do **not** implement it against D's tables. D owns the deletion of `Story`/`Consent`; A can at most orchestrate behind a narration interface. Kept as a documented stub until D's `narration` models exist.
- **Why:** implementing it now would require creating/editing D's `narration` app, which is out of scope. Narrator data is personal data under Kenya's Data Protection Act (BR-13/BR-14) — deletion must be correct, not guessed.
- **Change it:** team confirms owner. If A keeps it, implement once `narration.Story`/`Consent` and D's `log_audit()` are ready (see `docs/placeholders.md`).

## Restricted artefacts: no role is exempt
- See `docs/decisions.md` (2026-11-05). `visible_artefacts` treats restricted as restricted for every role, including curator/admin; access only via an `ArtefactAccess` grant. Flagged for the stand-up; blueprint §4 "curator reads all" is a product question for NMK.

## Invited accounts start with an unusable password
- **Unclear:** blueprint mentions "invite acceptance" but no backend acceptance endpoint is specified.
- **Choice:** `invite_staff` creates an active account with an unusable password; the person cannot sign in until an acceptance/set-password step (not yet built). Admin/superuser accounts for the Django-admin demo are made with `createsuperuser`/`setup_roles` and can sign in.
- **Change it:** add an accept-invite endpoint (set password from a signed token) when the sign-in flow is built. Recorded in `BLOCKERS.md`.

## Role change forbids changing your own role
- **Choice:** the role-change endpoint is admin-only AND refuses an admin changing their **own** role (prevents self-lockout and satisfies "nobody can change their own role"). A second admin must change an admin's role.
