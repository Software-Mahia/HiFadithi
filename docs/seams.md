# Seams: agreed handover points

Agree these on day 1. Change one only after telling the people who use it.

| Seam | Owner | Used by | Signature | Ready by |
|---|---|---|---|---|
| Custom user model | A | everyone | `accounts.User` with `role` in {researcher, curator, admin} | Day 1 (tonight) |
| Permission classes | A | everyone | `core.permissions.IsResearcher / IsCurator / IsAdmin` | Day 2 |
| Visible artefacts | A | B, D | `access.selectors.visible_artefacts(user) -> QuerySet[Artefact]` | Day 2 |
| Versions | D | C | `workflow.services.create_version(artefact, change_note, user) -> ModelVersion` | Day 2 |
| Storage helper | B | C, D | `core.storage.signed_download_url(bucket, path, expires_in=3600)`, `signed_upload_url(bucket, path, expires_in=3600, content_type=None)`, `object_exists(bucket, path)`. Buckets: `CAPTURES_BUCKET`, `MODELS_BUCKET`, `NARRATION_BUCKET` (any other raises `ValueError`). Photo links are signed with `content_type="image/jpeg"` | Done |
| Capture photos | B | C | `Capture.views` = `{front, back, left, right}` mapped to a key inside the captures bucket (`{artefact_id}/{capture_id}/{view}.jpg`, no bucket name); `Capture.upload_complete` is true only when all four objects exist; `artefacts.models.VIEW_KEYS` gives the order | Done |
| Capture and read API | B | capture page, D | `POST /api/artefacts/`, `POST /api/artefacts/{id}/captures/` (four signed upload links), `POST /api/artefacts/captures/{id}/complete/`, `GET /api/artefacts/{id}/`, `GET /api/artefacts/?q=&community=&object_type=&status=&limit=&offset=` (returns `{count, next, previous, results}`) | Capture: #7. Read: PR open |
| Seed data | B | everyone | `python manage.py seed_demo [--email EMAIL] [--force]`: creates DEMO-001 to DEMO-005 (fake, no 3D models); needs an existing admin; refuses unless DEBUG or `--force` | PR open |
| Backups | B | C | `scripts/backup_db.sh`, `scripts/restore_drill.sh` (local Docker); `.github/workflows/backup.yml` (nightly Supabase backup) | Local: done. Nightly: TODO |
| Status changes | D | C | `workflow.services.transition_model(model_version, to_status, reason, actor=None)` | Placeholder day 2, real day 3 |
| Status guard | D | B, D | `workflow.guard.ProtectedFieldsMixin` on `ModelVersion` (review_status, is_current) and B's `Artefact` (collection_status); `allow_status_change()` used only inside workflow services; DB trigger via `guard_operations()` | Day 3 |
| Admin helpers | A | everyone | `core.admin.ProtectedStatusAdminMixin`, `core.admin.service_action(description, service)` | Done |
| Roles in admin | A | everyone | `python manage.py setup_roles`; each owner adds their permissions to `ROLE_PERMISSIONS` | Done |
| Photo removal | A | admin | `access.services.remove_capture_photos(capture, reason, actor)`: storage + Meshy task | After day 6 (stub now) |
| Narrator deletion | A | D (consent withdrawal) | `access.services.delete_person_data(consent, actor)` | Day 5 |
| Audit | D | everyone | `audit.services.log_audit(actor, action, obj)` | Day 5 |
| Engine | C | A (after day 6) | `pipeline.engines.get_engine().delete(task_id)` | Day 2 (interface) |
| Deployed URL | C | everyone | `https://<host>/` with the Meshy webhook at `/api/webhooks/meshy/<token>/` | Day 4 |

## Known limits (B)

- `visible_artefacts()` still raises `NotImplementedError` (checked Fri 6 Nov). Every B endpoint that
  reads an artefact returns 500 on a running server until it lands, except creating an artefact. Tests
  substitute it.
- An upload link stays valid for an hour. `complete` checks that the four objects exist but does not
  freeze them, so a photo can be replaced after `complete` while the link is still valid.
- Database backups cover records only, not the photos in the storage buckets.
- Deleting an artefact removes its capture rows (CASCADE) but not the files in storage. Photo cleanup
  is `remove_capture_photos` (A).
- `artefacts/0001` is deployed: never edit it, add `0002` for any model change.
- `seed_demo` creates no 3D models, and `transition_model` ignores `actor` until the real rules land.
