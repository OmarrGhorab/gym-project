# Gym Platform API Constitution

This Constitution is the authoritative source of truth for all design, implementation,
review, refactoring, and maintenance of the Gym Platform Laravel API backend. It governs
human contributors and AI coding agents alike. Where any other guide, habit, or
convenience conflicts with this document, this document wins.

**Stack baseline (non-negotiable):** Laravel 12+, PHP 8.4+, MySQL, Redis, Queues, REST,
API-first. Code that assumes a lower baseline is non-compliant.

## Core Principles

### I. Laravel-First Architecture (NON-NEGOTIABLE)

Build with the framework, not around it. Laravel's native features are the default
toolbox and MUST be exhausted before any custom abstraction or third-party package is
introduced.

- Use native features first: Eloquent, Form Requests, Policies/Gates, API Resources,
  the queue system, the cache abstraction, events/listeners, jobs, notifications,
  the scheduler, and the container.
- A third-party package or custom abstraction MAY be added ONLY when a concrete need
  cannot be met natively. The justification MUST be recorded in the PR description and
  reference the specific native limitation encountered.
- Do NOT reimplement what the framework already provides (routing, validation,
  serialization, auth scaffolding, pagination, rate limiting).
- "We might want flexibility later" is NOT a valid reason to abstract away the framework.

Rationale: Framework-native code is the most maintainable, best-documented, most-hireable,
and most-upgradeable code in a Laravel project. Every layer of indirection added on top is
a liability that future maintainers and upgrades must carry.

### II. Thin Transport, Separated Business Logic (NON-NEGOTIABLE)

Controllers and other transport entry points are coordinators, never the home of business
logic.

- Controllers MUST only: resolve the validated request, invoke an Action/Service, and
  return an API Resource or response. A controller method SHOULD be readable in a few
  lines.
- Business logic lives in single-purpose **Action** or **Service** classes (invokable
  Actions are the default unit). These classes are framework-aware but transport-agnostic
  and MUST be callable from controllers, jobs, commands, and tests identically.
- Validation MUST live in **Form Requests**, never inline in controllers.
- Authorization MUST live in **Policies/Gates**, enforced at the boundary (Form Request
  `authorize()`, controller `authorize()`/`can` middleware, or policy calls). Controllers
  MUST NOT hand-roll permission checks.
- Response shaping MUST go through **API Resources**. Controllers MUST NOT return raw
  Eloquent models, arrays, or query results directly.

Rationale: Separating transport from logic makes behavior testable in isolation, reusable
across delivery mechanisms, and resistant to the slow rot of "just one more if-statement
in the controller."

### III. Test-First with Pest (NON-NEGOTIABLE)

Testing is part of the definition of done, not a follow-up task. **Pest** is the testing
framework; PHPUnit-style classes MUST NOT be introduced for new tests.

- A test-first mindset is mandatory: write the failing test that expresses the intended
  behavior, watch it fail, then implement until green, then refactor.
- Every API endpoint MUST have **feature tests** covering: happy path, validation
  failures, authentication required, authorization denied (403), and not-found (404)
  where applicable.
- Every non-trivial business rule (Actions/Services, domain calculations, state
  transitions) MUST have **unit tests**.
- Bug fixes MUST include a regression test that fails before the fix and passes after.
- The full suite MUST pass before merge. A red suite blocks merge — no exceptions, no
  skipped tests left behind to "fix later."

Rationale: Tests are the executable specification. They make refactoring safe, document
intent, and are the only durable proof that the system does what we claim.

### IV. Consistent, Versioned API Contracts (NON-NEGOTIABLE)

The API is a public contract and is treated as one.

- All API routes MUST be versioned via URI prefix (`/api/v1/...`). New breaking changes
  go in a new version; existing versions MUST NOT be broken in place.
- Responses MUST follow one consistent envelope across the entire API: a predictable
  shape for success (data + meta) and a predictable shape for errors (stable error
  structure with a machine-readable code, message, and validation details where relevant).
- HTTP status codes MUST be used correctly and consistently (200/201/204, 401, 403, 404,
  422, 429, 5xx).
- All transformation MUST flow through API Resources so the contract is defined in one
  place per resource, not scattered across controllers.
- Pagination, filtering, and sorting MUST use consistent, documented conventions across
  endpoints.

Rationale: Clients depend on stability. A predictable, versioned contract lets the backend
evolve without breaking consumers and removes guesswork for every integrator.

### V. Security by Default (NON-NEGOTIABLE)

Security is the default posture, aligned with the OWASP Top 10. Insecure-by-omission is a
defect.

- **Mass assignment**: models MUST explicitly declare `$fillable` (allowlist). `$guarded
  = []` or blanket fillable is forbidden. Never pass unfiltered request input into
  `create`/`update`.
- **Input handling**: all input MUST be validated via Form Requests; never trust client
  input for authorization decisions, IDs, prices, roles, or status.
- **Authentication & authorization**: every non-public endpoint MUST require
  authentication and MUST enforce a Policy/Gate. "Authenticated" is not "authorized" —
  ownership and role checks are mandatory.
- **Secrets**: no secrets, keys, or credentials in code or VCS — only via environment
  configuration.
- **Data exposure**: sensitive attributes MUST be hidden (`$hidden`) and never leaked
  through Resources. Error responses MUST NOT leak stack traces, SQL, or internals in
  production.
- **Injection & abuse**: use the query builder/Eloquent bindings (no raw concatenated
  SQL); apply rate limiting/throttling to auth and sensitive endpoints; enforce HTTPS
  assumptions and signed/expiring URLs where relevant.

Rationale: A gym platform handles personal data, memberships, and payments. A single
unguarded field or missing policy is a breach. Security cannot be retrofitted; it is a
build-time invariant.

### VI. Performance-Focused Data Access (NON-NEGOTIABLE)

Performance is designed in, with the database treated as the primary constraint.

- **N+1 is a defect.** Queries inside loops are forbidden. Relationships rendered by
  Resources MUST be eager-loaded (`with`/`load`). N+1 detection SHOULD be enabled in
  development (e.g. `preventLazyLoading` in non-production).
- **Indexing**: every column used in `where`, `join`, `order by`, or as a foreign key
  MUST be indexed via migration. Index decisions are part of schema review.
- **Caching**: expensive or hot read paths MUST use the Redis-backed cache with explicit,
  intentional invalidation. Cache keys and TTLs are deliberate, not incidental.
- **Queues**: expensive or slow work (email/notifications, exports, third-party calls,
  image/media processing, heavy aggregation) MUST be dispatched to queued jobs, not run
  inline in the request lifecycle.
- Pagination is mandatory for any collection endpoint that can grow unbounded; never
  return unbounded result sets.

Rationale: The cheapest performance is the kind you never have to fix in production.
N+1s, missing indexes, and synchronous heavy work are the predictable killers — this
principle bans them at the source.

### VII. Simplicity, YAGNI, and No Over-Engineering (NON-NEGOTIABLE)

The simplest design that satisfies the requirement wins.

- **YAGNI**: build for current, real requirements only. Do not add configuration,
  abstraction, or generality for hypothetical futures.
- **No needless repository pattern**: Eloquent IS the data layer. A repository
  abstraction over Eloquent MUST NOT be introduced by default; it is permitted only with
  a documented, concrete justification (e.g. a genuine need to swap persistence). Wrapping
  Eloquent "for testability" or "for cleanliness" is not a valid reason.
- Prefer Actions/Services over layered ceremony. Avoid interfaces with a single
  implementation, speculative base classes, and indirection that exists only to look
  enterprise-y.
- Duplication is cheaper than the wrong abstraction. Extract only when the pattern is real
  and repeated.

Rationale: Every abstraction has a carrying cost paid by everyone who reads the code
afterward. Simplicity is what keeps a production system maintainable as it grows and as
contributors change.

## Architecture & Engineering Standards

These standards operationalize the principles above and are binding.

**Layering**
- `Routes → Controller → Form Request (validate) + Policy (authorize) → Action/Service
  (business logic) → Eloquent (persistence) → API Resource (response)`.
- Actions/Services MUST NOT reference the HTTP request directly; they receive typed,
  already-validated inputs (DTOs or explicit arguments).

**Clean Architecture & SOLID**
- Single Responsibility per class; one reason to change. Fat classes MUST be split.
- Depend on abstractions only where a real seam exists; do not invent seams (see
  Principle VII).
- Keep domain rules independent of transport and framework glue where practical, without
  fighting the framework.

**Database & Migrations**
- All schema changes go through migrations; no manual/production schema edits. Migrations
  MUST be reversible (`down`) or explicitly documented as irreversible.
- Foreign keys MUST be declared with appropriate `on delete` behavior. Use proper column
  types, constraints, and `nullable` intent deliberately.
- Naming is consistent: plural snake_case tables, singular models, `*_id` foreign keys,
  timestamped migration files.
- Destructive migrations on populated tables MUST be called out explicitly in review and
  paired with a safe rollout/backfill plan.

**Logging & Observability**
- Use structured logging via the framework logger with appropriate levels; never `dd()`,
  `dump()`, `var_dump`, or `echo` in committed code.
- Log meaningful business and security events (auth failures, authorization denials,
  payment/membership state changes, queue job failures) with contextual metadata — never
  log secrets or full PII.
- Queued jobs MUST be observable: failures land on the `failed_jobs` table and are
  surfaced/alertable. Long-running and external calls MUST have timeouts and sensible
  retry/backoff.

**Documentation**
- Every endpoint's contract (inputs, outputs, status codes, auth/permission requirements)
  MUST be documented and kept in sync with the code.
- Non-obvious business rules MUST be documented at the Action/Service level. Code comments
  explain WHY, not WHAT.

## Security & Performance Requirements

**Security gates (all MUST hold before merge)**
- No endpoint ships without authentication (unless explicitly public) AND an enforced
  Policy/Gate.
- No model ships without an explicit `$fillable` allowlist; sensitive fields are
  `$hidden`.
- No raw, concatenated SQL; all dynamic queries use bindings.
- Sensitive/auth/write-heavy endpoints are rate-limited.
- No secrets in code; configuration via environment only.

**Performance gates (all MUST hold before merge)**
- No N+1 introduced; relationships used in responses are eager-loaded.
- Every queried/joined/ordered/foreign-key column is indexed.
- Unbounded collections are paginated.
- Heavy/slow work is queued, not synchronous.
- Hot read paths have an intentional caching + invalidation strategy where justified.

## Development Workflow & Quality Gates

**Definition of Done** for any change:
1. Behavior is covered by Pest tests (feature tests for endpoints, unit tests for logic),
   including failure and authorization paths.
2. Full test suite is green.
3. Validation is in Form Requests; authorization is in Policies/Gates; responses go
   through API Resources.
4. No N+1, required indexes exist, heavy work is queued.
5. Security gates above are satisfied.
6. API contract is consistent and documented; versioning respected.
7. Migrations are reversible/justified and reviewed.

**Code Review Quality Gates** — a reviewer (human or AI agent) MUST block the change if
any of the following is true:
- Business logic in a controller, or validation/authorization outside Form
  Requests/Policies.
- Raw models/arrays returned instead of API Resources.
- Missing or inadequate tests, or a skipped/disabled test added to pass CI.
- Mass-assignment exposure, missing auth/policy, secret in code, or raw SQL.
- N+1 query, missing index on a queried column, or synchronous heavy work.
- New repository pattern, package, or abstraction without a documented concrete
  justification (Principle I & VII).
- Breaking change to an existing API version, or inconsistent response envelope/status
  codes.
- `dd`/`dump`/debug output, or commented-out/dead code left in.

Reviews verify compliance with this Constitution first and style/taste second. "It works"
is necessary but not sufficient.

## Governance

- This Constitution supersedes all other practices, conventions, and preferences for this
  repository. AI coding agents MUST treat it as the authoritative source of truth when
  generating, reviewing, refactoring, or maintaining code, and MUST refuse to introduce
  changes that violate a NON-NEGOTIABLE principle.
- **Amendments** require: a written proposal describing the change and its rationale,
  review and approval by project maintainers, a version bump per the policy below, and a
  migration/remediation note for any existing code rendered non-compliant.
- **Versioning policy** (semantic):
  - MAJOR — removal or redefinition of a principle, or a backward-incompatible governance
    change.
  - MINOR — a new principle/section or materially expanded guidance.
  - PATCH — clarifications, wording, and non-semantic fixes.
- **Compliance**: every PR and review MUST verify compliance. Any necessary deviation
  MUST be justified in writing in the PR, scoped as narrowly as possible, and approved by
  a maintainer; unjustified complexity MUST be rejected.
- For day-to-day runtime guidance that elaborates on (but never contradicts) this
  document, defer to the agent guidance files in the repository; on any conflict, this
  Constitution controls.

**Version**: 1.0.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-06-10
