---
name: feedback-recurring-gaps
description: Recurring readiness gaps observed in Gym Platform audits — check these first on future phases
metadata:
  type: feedback
---

Patterns observed during the Phase 0 release-readiness audit (T072, 2026-06-10). Check these proactively in later phases.

- **Recording tasks lag implementation.** Polish/record tasks in `tasks.md` (e.g. T067 formatting record, T068 test-result record) are frequently left unwritten even when the underlying condition (Pint clean, suite green) is true. Always diff `specs/<feature>/reviews/` against the task list and flag missing record files as blockers — the DoD requires the record, not just the green run.
  - **Why:** the project treats `tasks.md` as the binding Definition of Done; an unrecorded gate is an unverified gate.
  - **How to apply:** before issuing a verdict, list `reviews/*.md` and confirm one exists for every review/record task.

- **`UserResource` lazy-loads roles/permissions.** `getRoleNames()`/`getAllPermissions()` lazy-load on access (~2-3 queries/render). Bounded for single-user endpoints but a true 1+N once rendered over a collection. Recommend the eager-load fix before any phase adds a user/staff list endpoint. See [[project-release-standards]].

- **Throttle coverage.** Login uses `throttle:auth` keyed on IP only; `/auth/me` had no throttle at all. And the 429 path is often documented but not actually asserted by a feature test. When auditing throttled endpoints, verify both the route middleware AND a test that asserts 429 + `error.code = too_many_requests`.

- **Private disk `serve => true`.** `config/filesystems.php` local disk serves files without an auth gate. Harmless until a phase stores sensitive uploads/exports — flag as a prerequisite the moment a phase writes private files.
