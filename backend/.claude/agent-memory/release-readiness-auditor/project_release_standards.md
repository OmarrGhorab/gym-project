---
name: project-release-standards
description: Gym Platform backend gating standards — Constitution principles, artifact locations, and test/format commands
metadata:
  type: project
---

Gym Platform REST API backend (Laravel 12 / PHP 8.4). Release gating is governed by `.specify/memory/constitution.md` (v1.0.0) — authoritative, outranks CLAUDE.md on conflict.

**Where evidence lives:**
- Tasks / Definition of Done per feature: `specs/<feature>/tasks.md`. The task list IS the binding DoD — a missing recording task (e.g. formatting/tests record files) blocks a formal PASS even if the underlying condition is verified true.
- Review records: `specs/<feature>/reviews/` — architecture.md, security.md, performance.md, code-review.md, tests.md, formatting.md, release-readiness.md.
- API contract: `specs/<feature>/contracts/api.md`. Validation guide: `specs/<feature>/quickstart.md`.
- Migrations: `database/migrations/` (timestamped; every one MUST have `down()` or be documented irreversible).
- Tests: `tests/Feature/...` and `tests/Unit/...`, Pest only (no PHPUnit-style classes for new tests). `tests/Pest.php` scopes `RefreshDatabase` to Feature.

**Constitution NON-NEGOTIABLEs that gate merge:** Laravel-first/YAGNI; thin transport (logic in Actions, validation in Form Requests, authz in Policies/middleware, output via Resources); test-first Pest with full matrix (happy/401/403/404/422 + 429 on throttled); versioned `/api/v1`; uniform envelope `{data,meta,message}` success and `{error:{code,message,details}}` error; explicit `$fillable`+`$hidden`; eager-load relations rendered by Resources; index every where/join/order/FK column; queue heavy work; reversible migrations.

**Commands:** `pint --test` (formatting gate), full suite via artisan test. See [[reference-php84-binary]] for the required PHP binary. Tests run SQLite in-memory, sync queue, array cache.

**Cross-phase contracts to never pre-empt/fork (CLAUDE.md):** `sold_by_user_id` references `users` (P1/P2); a single polymorphic `payments` table (`payable_type`/`payable_id`) defined once in P1 and reused. Phase 0 introduced neither — grep migrations for these before approving any later phase.
