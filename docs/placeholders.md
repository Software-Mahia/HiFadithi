# Placeholders — cross-slice stubs A depends on

A never implements these; each is owned by B, C or D. A calls the agreed interface
(see `docs/seams.md`) and stubs/guards where the real thing is not ready.

| Seam | Owner | Interface A uses | Real yet? | How A copes now |
|---|---|---|---|---|
| `search_artefacts(query, community, object_type)` | B | returns visible artefacts with current version | partial (artefacts models merged; selector TBD) | A's collection list (front end, deferred) will call it; backend A does not call it yet |
| `core.storage` object **delete** helper | B | `delete_object(bucket, path)` (does not exist) | NO | `remove_capture_photos` stub records this; B must add a delete helper |
| `pipeline.engines.get_engine().delete(task_id)` | C | `Engine.delete` in `pipeline/engines/base.py` | YES (fake + meshy) | `remove_capture_photos` can call it once the storage delete exists |
| `transition_model(model_id, to_status, reason)` | D | the only writer of `review_status`/`is_current`/`collection_status` | partial (workflow app present, guard tests Postgres-only) | A only **reads** status; A never writes these fields |
| `log_audit(actor, action, obj)` | D | writes an `audit_events` row | partial | A's `delete_person_data`/`remove_capture_photos` will log through it when built |
| `narration.Story` / `narration.Consent` | D | models for narrator data | NO (stub models) | `delete_person_data` kept as a documented stub; A does not touch `narration` |

Rule: if a dependency is not ready, A stubs behind the interface and records it here. A
does not build B/C/D's real version.
