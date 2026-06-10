# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

REST API backend for a **Gym Platform** (members, subscriptions, POS, payroll, reporting). Laravel 12 / PHP 8.4+, MySQL, Redis, Queues, API-first. The repo is currently a **fresh Laravel skeleton** — almost nothing in `app/` is built yet. The work is delivered in five sequential phases documented in `phases/`.

## The Constitution governs everything

`.specify/memory/constitution.md` is the **authoritative source of truth**. It outranks habit, convenience, and this file on any conflict. Read it before designing or implementing. Its NON-NEGOTIABLE principles are enforced at review time and a violation blocks merge. The essentials:

- **Laravel-first**: exhaust native features (Eloquent, Form Requests, Policies, API Resources, queues, cache, events, jobs) before adding any package or custom abstraction. Justify any addition in the PR against a concrete native limitation.
- **Thin transport**: controllers only resolve a validated request → invoke an Action/Service → return an API Resource. Validation lives in **Form Requests**, authorization in **Policies/Gates**, response shaping in **API Resources**. No business logic, raw models, or hand-rolled permission checks in controllers.
- **Layering**: `Route → Controller → FormRequest (validate) + Policy (authorize) → Action/Service (logic) → Eloquent → API Resource`. Actions/Services never touch the HTTP request — they take typed, already-validated inputs.
- **Test-first with Pest**: write the failing test first. Every endpoint needs feature tests (happy path, validation 422, auth 401, authz 403, 404). Every non-trivial rule needs unit tests. Bug fixes need a regression test. No PHPUnit-style classes for new tests. Red suite blocks merge.
- **Versioned contract**: all routes under `/api/v1`. One response envelope everywhere — `{ data, meta, message }` for success, a stable error shape for failures. Correct HTTP status codes. Never break an existing version in place.
- **Security by default**: explicit `$fillable` allowlist (never `$guarded = []`); `$hidden` for sensitive fields; every non-public endpoint authenticated AND policy-gated; bindings only (no raw SQL); rate-limit auth/sensitive/write endpoints; secrets via env only.
- **Performance**: N+1 is a defect — eager-load relations rendered by Resources. Index every column used in `where`/`join`/`order by`/FK. Paginate unbounded collections. Queue heavy work (mail, exports, third-party calls, media, heavy aggregation). Cache hot read paths with intentional invalidation.
- **YAGNI**: simplest design that meets the real requirement. No repository pattern over Eloquent, no single-implementation interfaces, no speculative abstraction. Duplication beats the wrong abstraction.

## Mandatory workflow (do not bypass any step)

For every feature/change, in order:

1. **Analyze requirements** — against the relevant `phases/` doc and the Constitution.
2. **Review architecture** — use the `laravel-architecture-reviewer` agent *before* writing code.
3. **Implement feature** — `laravel-feature-engineer` agent; test-first.
4. **Run tests** — full Pest suite green.
5. **Security review** — `laravel-security-reviewer` agent.
6. **Performance review** — `laravel-performance-reviewer` agent.
7. **Final code review** — `laravel-code-reviewer` agent (and `release-readiness-auditor` as the final gate).

Specialized review agents live in `.claude/agents/` (architecture, code, security, performance, test, api-contract, database-schema reviewers, qa-defect-hunter, release-readiness-auditor). Use them at the matching step rather than reviewing inline.

## Commands

```bash
composer setup                  # install deps, key:generate, migrate, npm build (first-time)
composer dev                    # serve + queue:listen + vite concurrently
composer test                   # config:clear then artisan test (full suite)
php artisan test --filter=Name  # run a single test by name/class
php artisan test tests/Feature/AuthTest.php   # run one file
vendor/bin/pint                 # format (run before committing; Pint is the formatter)
php artisan migrate             # apply migrations
php artisan queue:listen        # process queued jobs
```

Tests run on SQLite in-memory with `sync` queue and `array` cache/session (see `phpunit.xml`) — fast and isolated; do not assume MySQL/Redis in tests.

## Build plan & current state

Read `phases/` in order: `Phase-0` (foundation) → `Phase-1..4` → `Phase-Connections-and-Integration-Map.md` (the glue: dependency graph and produces→consumes contracts). Each phase is self-contained and shippable; confirm a phase's Acceptance Criteria + handoff checklist before starting the next.

**Phase 0 is not done yet.** These required packages are *not installed* and must be added per Phase 0: `laravel/sanctum`, `spatie/laravel-permission`, `spatie/laravel-activitylog`, `spatie/laravel-query-builder`, `maatwebsite/excel`, `barryvdh/laravel-dompdf`, and **Pest**. There is no `routes/api.php`, no `/api/v1` group, no response-envelope base Resource, and current tests are placeholder PHPUnit examples. Phase 0 establishes auth (Sanctum), roles/permissions (Spatie), `activity_log`, `settings`, the response envelope, and the `/api/v1` structure — everything else depends on it.

Two integration contracts to preserve across phases (see the map):

- **`sold_by_user_id`** on subscriptions (P1) and sales (P2) references `users` (no forward dependency on `employees`); P3 links commissions via `employees.user_id` + a backfill command.
- **Polymorphic `payments`** defined once in P1 (`payable_type`/`payable_id`, status paid/partial/due), reused for sales in P2, read as the single revenue source in P3. Do not fork payment logic.

## Conventions

- DB naming: plural snake_case tables, singular models, `*_id` FKs, timestamped migrations. Migrations must be reversible (`down`) or explicitly documented as irreversible; FKs declare `on delete` behavior.
- Structured logging via the framework logger only — no `dd`/`dump`/`var_dump`/`echo` in committed code. Log security/business events (auth failures, authz denials, payment/membership state changes, job failures) without secrets/PII.
- Every endpoint's contract (inputs, outputs, statuses, auth/permission) must be documented and kept in sync. Comments explain WHY, not WHAT.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
