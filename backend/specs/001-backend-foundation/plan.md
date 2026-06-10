# Implementation Plan: Backend Phase 0 Foundation

**Branch**: `001-backend-foundation` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Backend-only Phase 0 foundation from `phases/Phase-0-Setup-and-Foundation.md`, excluding all Next.js/dashboard/frontend work and excluding project initialization that is already done.

## Summary

Implement the missing backend foundation pieces for the Gym Platform API: `/api/v1` routes, health check, auth API, current-user API, logout API, response envelope, uniform errors, roles/permissions, sample gated route, audit log, settings storage, queue/cache/storage/realtime readiness checks, API documentation, and Pest test coverage.

Do not rebuild the Laravel app setup. Do not implement Next.js, dashboard login, RTL shell, UI permission gates, frontend hooks, or frontend components.

## Current Backend State

Checked files under `app/`, `routes/`, `database/`, `config/`, and `tests/`.

### Already Present

- Laravel 12 skeleton exists.
- `app/Models/User.php` exists with explicit `$fillable`, `$hidden`, and password hashing cast.
- Base user-related migration exists:
  - `users`
  - `password_reset_tokens`
  - `sessions`
- Cache table migration exists:
  - `cache`
  - `cache_locks`
- Queue table migration exists:
  - `jobs`
  - `job_batches`
  - `failed_jobs`
- Base config files exist for auth, cache, database, filesystems, logging, mail, queue, services, and session.
- `routes/web.php` and `routes/console.php` exist.
- `DatabaseSeeder` exists, currently seeding a placeholder test user.
- Placeholder PHPUnit-style example tests exist.

### Missing For Phase 0 Backend

- `routes/api.php`.
- `/api/v1` route registration in `bootstrap/app.php`.
- `/api/v1/health` endpoint.
- Standard success envelope `{ data, meta, message }`.
- Stable error response shape for `401`, `403`, `404`, `422`, `429`, and unexpected errors.
- Base API controller/helper for enveloped responses.
- API Resources for user/current-user output.
- Form Requests for auth input validation.
- Auth API endpoints:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
- Sanctum token support and `personal_access_tokens` table.
- Role and permission tables/config/seed data.
- Initial roles: Admin, Manager, Cashier, Captain, Accountant.
- Initial foundation permission for sample gated route.
- Sample protected route proving permission enforcement.
- Policy/Gate or permission middleware enforcement for non-public endpoints.
- Activity log tables/config and at least one tracked event.
- `settings` table/model/action path for key/value foundation settings.
- Queue probe job proving dispatch/processing path.
- Cache read/write readiness proof.
- Storage readiness proof for local disk and remote-compatible disk config.
- Realtime/broadcast readiness config/proof.
- Pest installation/configuration and replacement of placeholder PHPUnit-style examples.
- Feature/unit tests for Phase 0 backend scope.
- Backend API contract documentation for the Phase 0 endpoints.

## Technical Context

**Language/Version**: Existing Laravel backend. Do not reinitialize the project. Keep implementation compatible with the project constitution baseline.

**Primary Dependencies Needed For Missing Backend Work**:

- Laravel Sanctum for API tokens.
- Spatie Laravel Permission for roles/permissions.
- Spatie Laravel Activitylog for audit records.
- Spatie Laravel Query Builder, Maatwebsite Excel, and Barryvdh DomPDF are Phase 0 package prerequisites for later backend phases, but this plan does not create export/report APIs yet.
- Pest for all new tests.

**Storage/Data**:

- Existing: `users`, `password_reset_tokens`, `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`.
- Add: `personal_access_tokens`, Spatie permission tables, `activity_log`, `settings`.

**Testing**: New tests must be Pest tests. Existing placeholder example tests should be removed or converted.

**Target Platform**: Backend API only.

**Scope Boundary**: API, DB, backend services/actions, backend config wiring, seeders, tests, and docs only. No Next.js/frontend implementation.

## Constitution Check

**Gate Result**: PASS for the planned backend shape.

- Laravel-first: use Laravel routing, Form Requests, API Resources, policies/gates/middleware, Eloquent, migrations, seeders, jobs, cache, storage, and framework exception handling.
- Thin transport: controllers only validate/authorize, call Actions where useful, and return Resources/enveloped responses.
- Test-first with Pest: write endpoint and foundation tests before implementation.
- Versioned API: all new API routes live under `/api/v1`.
- Security: all non-public routes require auth and authorization; models use explicit `$fillable`; sensitive fields stay hidden; login is throttled; no raw SQL.
- Performance: no unbounded collection endpoints in this phase; indexed lookup columns for new tables; heavy readiness work is represented by queued jobs, not synchronous long work.
- Simplicity: no repositories, no speculative interfaces, no business-module abstractions.

## Backend Implementation Plan

### 1. API Routing And Response Contract

- Add `routes/api.php`.
- Register API routing in `bootstrap/app.php`.
- Create `/api/v1` group.
- Add public `GET /api/v1/health`.
- Add shared success envelope helper/base resource behavior.
- Add exception rendering for stable JSON errors:
  - validation failed `422`
  - unauthenticated `401`
  - forbidden `403`
  - not found `404`
  - throttled `429`
  - unexpected error without leaking internals

### 2. Authentication APIs

- Add Sanctum token support to `User`.
- Add required Sanctum migration/config.
- Add Form Request for login.
- Add thin Auth controller:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/logout`
- Add user/current-user API Resource returning:
  - id
  - name
  - email
  - roles
  - permissions
- Throttle login and sensitive auth routes.

### 3. Roles, Permissions, And Sample Gate

- Add permission package migration/config.
- Add roles and foundation permissions seeders.
- Seed roles:
  - Admin
  - Manager
  - Cashier
  - Captain
  - Accountant
- Add initial permission:
  - `foundation.access-sample`
- Assign the foundation permission to Admin.
- Add sample protected endpoint:
  - `GET /api/v1/foundation/protected-sample`
- Protect sample endpoint with auth and permission authorization.

### 4. Audit Logging

- Add activity log migration/config.
- Record at least one foundation event, preferably login/logout or sample protected access.
- Ensure audit properties never include password, token, or secrets.
- Add tests that verify an audit entry is created with actor/event/context.

### 5. Settings Storage

- Add `settings` migration:
  - `id`
  - unique `key`
  - JSON `value`
  - timestamps
- Add `Setting` model with explicit `$fillable`.
- Add focused action/service for storing and reading foundation settings.
- Add tests for saving and reading a branding placeholder setting.
- Keep settings API endpoints out unless needed by tests; Phase 0 only requires backend storage/readiness.

### 6. Queue, Cache, Storage, And Realtime Readiness

- Add a foundation probe job to prove dispatch/processing path.
- Add cache read/write proof in tests or a focused foundation action.
- Verify local disk write/read in tests.
- Ensure remote-compatible disk configuration is present for later R2/S3 usage.
- Ensure broadcast/realtime config is present and safe in tests.
- Do not add dashboard-facing realtime UI.

### 7. Tests

Create Pest coverage for:

- `GET /api/v1/health` returns enveloped success.
- Validation errors use stable `422` shape.
- Invalid login returns safe auth error.
- Valid login returns user, roles, permissions, and token.
- `GET /api/v1/auth/me` requires auth.
- `GET /api/v1/auth/me` returns current user data.
- `POST /api/v1/auth/logout` revokes current token.
- Sample protected endpoint returns `401` without auth.
- Sample protected endpoint returns `403` without permission.
- Sample protected endpoint succeeds with permission.
- Audit entry is recorded for the selected tracked action.
- Setting can be saved and read back.
- Queue probe job can be dispatched/processed under test config.
- Cache read/write works under test config.
- Storage readiness works under test config.

Run:

```bash
vendor/bin/pint
composer test
```

## Project Structure For Planned Backend Additions

```text
app/
├── Actions/
│   ├── Auth/
│   ├── Foundation/
│   └── Settings/
├── Http/
│   ├── Controllers/Api/V1/
│   ├── Requests/Auth/
│   └── Resources/
├── Jobs/
├── Models/
└── Providers/

database/
├── migrations/
└── seeders/

routes/
└── api.php

tests/
├── Feature/Api/V1/
└── Unit/
```

## Review Gates

1. Analyze requirements against Phase 0 and the constitution.
2. Review architecture before implementation.
3. Implement backend feature test-first.
4. Run full tests.
5. Run security review.
6. Run performance review.
7. Run final code review.

## Out Of Scope

- Laravel project reinitialization.
- Next.js setup or dashboard implementation.
- RTL Arabic layout.
- Frontend login page/session storage.
- `useAuth`, `usePermission`, `<Can>`, data table, forms, toast, confirm dialog, or any browser UI.
- Business modules from later phases: members, subscriptions, plans, payments, POS, products, inventory, employees, payroll, reports, exports, or final branding UI.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
