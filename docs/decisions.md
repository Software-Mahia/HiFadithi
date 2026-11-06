# Decisions

Short record of choices that are not obvious from the code. Newest first.

## 2026-11-05 — Restricted artefacts: no role is exempt (A)

`access.selectors.visible_artefacts(user)` treats a restricted artefact as visible only when
an `ArtefactAccess` row names the user or the user's role. Admin and curator are **not**
exempt, so BR-12's leak test holds for every role.

- Blueprint §4 says a curator "reads all verified records". That is a product question for NMK,
  not a reason to weaken the restriction in code. If curators should see every restricted
  artefact, add one role grant (`ArtefactAccess(role="curator")`) per restricted object, or
  revisit this selector. Flagged for the day-2 stand-up.
- An inactive or anonymous user sees nothing.
- A grant names exactly one of `user` or `role` (DB check constraint), and is unique per
  (artefact, user) and per (artefact, role).
