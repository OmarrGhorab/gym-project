# Research: Backend Phase 0 Foundation

## Decision: Keep this phase backend-only and gap-based

**Rationale**: The Laravel and Next.js projects already exist. The missing Phase 0 backend value is API/database foundation work, not reinitializing either project.

**Alternatives considered**:

- Re-run project setup: rejected because the user already completed setup and asked not to change it.
- Include dashboard/Next.js work: rejected because frontend scope is explicitly excluded.

## Decision: Use token-based API authentication for the first backend contract

**Rationale**: The backend can be implemented and tested independently of dashboard domain/session choices. Token-based API requests are straightforward for automated tests and later frontend integration.

**Alternatives considered**:

- Same-domain cookie session flow: useful later if the dashboard shares a root domain, but it couples this backend phase to frontend deployment decisions.
- Custom token storage: rejected because Laravel Sanctum is the Phase 0 requirement and avoids custom auth primitives.

## Decision: Establish one response envelope and one error shape before business modules

**Rationale**: All later phases consume this API contract. Locking the envelope now prevents inconsistent controller responses and client rewrites later.

**Alternatives considered**:

- Use Laravel defaults per error type: rejected because Phase 0 requires uniform `401`, `403`, `404`, `422`, `429`, and server error shapes.
- Return raw arrays or models from controllers: rejected by the constitution.

## Decision: Implement roles/permissions with the Phase 0 package, not custom tables

**Rationale**: The phase explicitly requires role/permission infrastructure and later phases add module permissions to the same system.

**Alternatives considered**:

- Custom `roles` and `permissions` tables: rejected as unnecessary and higher risk.
- Delay permissions until Phase 4: rejected because all non-public endpoints need authorization from the start.

## Decision: Prove settings through backend storage/actions first

**Rationale**: Later phases need a settings contract, but Phase 0 does not need a dashboard settings workflow. A `settings` table plus backend read/write action and tests is enough.

**Alternatives considered**:

- Build settings API endpoints now: deferred unless implementation tests require an HTTP proof, because it adds surface area beyond Phase 0 API endpoints.
- Skip settings until branding: rejected because reminders, VAT, receipts, and branding depend on this foundation.

## Decision: Use test-safe readiness checks for queue/cache/storage/realtime

**Rationale**: The project test environment uses isolated drivers. Readiness should prove backend integration paths without requiring live Redis, object storage, or broadcast services during tests.

**Alternatives considered**:

- Require external infrastructure in the test suite: rejected because it would slow and destabilize the suite.
- Leave these systems untested: rejected because later phases depend on them.

## Decision: Keep Actions/Services focused and avoid repositories

**Rationale**: The constitution requires thin controllers and Laravel-first Eloquent usage. Small Actions are useful for auth/settings/probes, but repositories or single-use interfaces would add ceremony.

**Alternatives considered**:

- Put business/application logic directly in controllers: rejected by the constitution.
- Add repository abstractions: rejected because Eloquent is the data layer and no persistence swap is required.
