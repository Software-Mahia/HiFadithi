# Seams: agreed handover points

Agree these on day 1. Change one only after telling the people who use it.

| Seam | Owner | Used by | Signature | Ready by |
|---|---|---|---|---|
| Custom user model | A | everyone | `accounts.User` with `role` in {researcher, curator, admin} | Day 1 (tonight) |
| Permission classes | A | everyone | `core.permissions.IsResearcher / IsCurator / IsAdmin` | Day 2 |
| Visible artefacts | A | B, D | `access.selectors.visible_artefacts(user) -> QuerySet[Artefact]` | Day 2 |
| Storage helper | B | C, D | `core.storage.signed_download_url(bucket, path)`, `signed_upload_url(bucket, path)` | Day 2 |
| Seed data | B | everyone | `python manage.py seed_demo` | Day 4 |
| Versions | D | C | `workflow.services.create_version(artefact, change_note, user) -> ModelVersion` | Day 2 |
| Status changes | D | C | `workflow.services.transition_model(model_version, to_status, reason, actor=None)` | Placeholder day 2, real day 3 |
| Status guard | D | B, D | `workflow.guard.ProtectedFieldsMixin` on `ModelVersion` (review_status, is_current) and B's `Artefact` (collection_status); `allow_status_change()` used only inside workflow services; DB trigger via `guard_operations()` | Day 3 |
| Admin helpers | A | everyone | `core.admin.ProtectedStatusAdminMixin`, `core.admin.service_action(description, service)` | Done |
| Roles in admin | A | everyone | `python manage.py setup_roles`; each owner adds their permissions to `ROLE_PERMISSIONS` | Done |
| Photo removal | A | admin | `access.services.remove_capture_photos(capture, reason, actor)`: storage + Meshy task | After day 6 (stub now) |
| Narrator deletion | A | D (consent withdrawal) | `access.services.delete_person_data(consent, actor)` | Day 5 |
| Audit | D | everyone | `audit.services.log_audit(actor, action, obj)` | Day 5 |
| Engine | C | A (after day 6) | `pipeline.engines.get_engine().delete(task_id)` | Day 2 (interface) |
| Deployed URL | C | everyone | `https://<host>/` with the Meshy webhook at `/api/webhooks/meshy/<token>/` | Day 4 |
