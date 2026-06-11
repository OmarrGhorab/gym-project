---
name: project-constitution-gates
description: The authoritative Constitution location and its merge-blocking NON-NEGOTIABLE gates for the Gym Platform API
metadata:
  type: project
---

The Constitution is at `.specify/memory/constitution.md` (v1.0.0, ratified 2026-06-10) and is the authoritative source of truth — it outranks CLAUDE.md and habit. The repo's Laravel app lives at the repository ROOT (`app/`, `routes/`, `tests/`), NOT under `backend/` — the `git diff` name prefix shows `backend/` but those paths do not exist; read files from the root.

**Why:** Reviews must verify Constitution compliance first, style second. These gates each individually BLOCK merge.

**How to apply — block the change if any hold:**
- Business logic / data access in a controller OR a Resource (Resources are output-shaping only). Validation outside Form Requests, authz outside Policies/Gates.
- Raw models/arrays returned instead of API Resources (analytic aggregate arrays for reports are tolerated and match the contract).
- PHPUnit-style test classes for NEW tests (`class …Test extends TestCase` + `test_*` methods). Pest function style (`it()`/`uses(RefreshDatabase::class)`) is mandatory.
- `$guarded = []` or missing `$fillable`; missing `$hidden` on sensitive fields; missing auth/policy; secret in code; raw concatenated SQL.
- N+1, missing index on a queried/joined/ordered/FK column, or synchronous heavy/unbounded work (must be queued or bounded).
- New repository pattern / package / single-impl interface without documented justification.
- Breaking an existing API version; inconsistent `{data,meta,message}` envelope or status codes.
- `dd`/`dump`/debug output or commented-out dead code.

Stack: Laravel 12, PHP 8.4, MySQL/Redis. Tests run on SQLite in-memory, `sync` queue, `array` cache (phpunit.xml) — do not assume MySQL/Redis behavior in tests. Money handled via `bcmath` (bcadd/bcsub/bcmul/bccomp), decimal casts, `number_format(...,2,'.','')` in Resources. Permissions via spatie; route-level `permission:*` middleware + Policy in Form Request `authorize()` is the established double-gate pattern. See [[feedback-recurring-violations]].
