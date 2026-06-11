# Implementation Plan: Permissions Matrix, Audit, Export & Branding

**Branch**: `005-permissions-audit-branding` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Phase 4 from `phases/Phase-4-Permissions-Audit-Branding-QA.md`, consolidating everything built in Phase 0 (auth/Sanctum, Spatie roles+permissions, `activity_log`, `settings`, response envelope, `/api/v1`), Phase 1 (members/subscriptions/plans/payments/notifications), Phase 2 (products/sales/inventory), Phase 3 (employees/payroll/commissions/expenses/reports).

## Summary

Phase 4 introduces **no new business tables and no new business features**. It is a hardening-and-finalization layer that exposes and consolidates four cross-cutting capabilities the earlier phases already laid foundations for:

1. **Final permission matrix + role management** — surface the existing Spatie permissions/roles through an API (`/permissions`, `/roles` CRUD, `/users/{id}/roles`), consolidate the per-module permission constants (`FoundationPermissions`, `MembershipPermissions`, `PosPermissions`, `HrFinancePermissions`) into one authoritative matrix, finalize the five role presets (Admin / Manager / Cashier / Captain / Accountant) in a single consolidated seeder, and support **custom roles**. Close any ungated-endpoint gaps so every non-public endpoint enforces a permission.
2. **Audit-log API** — surface the existing `spatie/laravel-activitylog` data through `GET /audit-logs` with subject/causer/date-range filters and pagination, and **close the `LogsActivity` adoption gaps** (currently missing on the models that should be audited).
3. **Generic export** — one parameterized `GET /export/{resource}` for members, subscriptions, sales, payments, payroll, reports → Excel/CSV (maatwebsite/excel) and PDF (dompdf), reusing each module's existing filter conventions, gated by the same permission as the resource's index, **queued** for large datasets with a retrievable download link.
4. **Settings & ATP branding** — `GET/PUT /settings` over the existing `settings` table (name, colors, logo, `reminder_days`, currency, VAT, receipt template), consumed by the reminder finder (P1) and POS receipts (P2).

Plus an **app-level security pass** (add `config/cors.php` locked to the dashboard origin; throttle login/POS/export; mass-assignment/`$hidden` review) and a **performance pass** (final index/slow-query review; Redis-cached dashboards already exist).

Everything is Laravel-native and uses **already-installed** packages — no additions. The work is overwhelmingly *exposure and consolidation* of Phase 0–3 infrastructure, not new domain logic.

## Technical Context

**Language/Version**: PHP 8.4 (confirmed `8.4.0`), Laravel 12.

**Primary Dependencies** (all already in `composer.json` — **no additions**):
- `laravel/sanctum` — auth (existing `auth:sanctum` group).
- `spatie/laravel-permission` ^7 — RBAC. Roles/permissions already seeded per-module; Phase 4 exposes them via API + adds custom-role support.
- `spatie/laravel-activitylog` ^5 — audit. `LogsActivity` already on 11 models; Phase 4 adds the viewer API + fills adoption gaps.
- `spatie/laravel-query-builder` ^7 — list filtering/sorting (already used by `MemberController`, `EmployeeController`, `ExpenseController`); reused for `/audit-logs` and to mirror each resource's filters in export.
- `maatwebsite/excel` ^3.1 — Excel/CSV export (not yet used; `app/Exports/` does not exist).
- `barryvdh/laravel-dompdf` ^3.1 — PDF export (already used for payslips in P3).
- `pestphp/pest` ^3 + laravel plugin — test-first.

**Storage**: MySQL (production); SQLite in-memory (tests). **No new tables.** Uses existing `settings` (key→JSON value) and `activity_log` (Spatie). Migrations in this phase are limited to: (a) a review/top-up migration adding any **missing indexes** flagged in the performance pass (notably on `activity_log` filter columns: `log_name`, `subject_type`, `causer_id`, `created_at` — Spatie ships some; verify and add composites), and (b) nothing destructive.

**Testing**: Pest only, test-first. SQLite in-memory, `sync` queue, `array` cache/session (per `phpunit.xml`). Note: queued-export tests assert dispatch via `Queue::fake()`/`Bus::fake()` rather than relying on `sync` to prove the "queued" requirement (FR-019). Excel assertions via `Excel::fake()`.

**Target Platform**: Backend REST API only, `/api/v1`. (Frontend `/settings`, `/audit-logs`, export buttons, RTL/responsive QA are out of scope for the backend deliverable — see Out of Scope.)

**Performance Goals**: No N+1 (eager-load `causer`/`subject` in the audit viewer). Audit and export list reads paginated. Large exports **queued** (never inline). Final index review across all modules' `where`/`join`/`order by`/FK columns; `activity_log` filter columns indexed. Existing Redis-cached dashboards retained.

**Constraints**: One response envelope (`{ data, meta, message }` / stable error shape) across all new endpoints, correct status codes (200/201/204, 401, 403, 404, 422, 429). Settings validated (reminder_days ≥ 0; VAT 0–100; colors well-formed hex; logo size/type limits). Export download links are user-scoped and time-limited (signed/temporary URL). No total admin lock-out: deleting/editing a role cannot remove the last holder of role-management permission.

**Scale/Scope**: 0 new tables; ~1 index-review migration. ~6 new endpoints (`/permissions`, `/roles` CRUD = 5 verbs on one resource, `/users/{id}/roles`, `/settings` GET+PUT, `/audit-logs`, `/export/{resource}`). ~8 Actions (`StoreRole`, `UpdateRole`, `DeleteRole`, `SyncUserRoles`, `UpdateSettings`, `BuildExport`, plus the existing `StoreSetting`). 1 queued Job (`GenerateExportJob`). ~6 Export classes (one per resource, using maatwebsite). 1 new `BrandingPermissions`/`SystemPermissions` support class for `roles.*`, `settings.*`, `audit.view`, `export.*`. 1 consolidated `RoleMatrixSeeder` finalizing the five presets across **all** modules' permissions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — PASS.*

| Principle | How this plan complies |
|-----------|------------------------|
| **I. Laravel-First** | Spatie permission/activitylog/query-builder, maatwebsite/excel, dompdf, native queues, native `config/cors.php`, native `RateLimiter` — all native or already-installed. No new package. Custom roles use Spatie's `Role`/`Permission` models directly (no wrapper). |
| **II. Thin Transport** | Controllers validate (Form Request) → authorize (Policy/`permission:` middleware) → call Action → return Resource. Logic in `Actions/Roles`, `Actions/Settings`, `Actions/Export`. The export Action builds a query/dataset; the Job runs it. Actions take typed inputs, never the Request. |
| **III. Test-First Pest** | Every new endpoint: feature tests (happy/422/401/403/404). Unit/feature tests for: permission-matrix completeness (an automated sweep asserting every non-public route has a `permission:` gate — SC-001), role CRUD + custom role enforcement, lock-out guard, audit filters, export per-format + queued dispatch + permission denial, settings validation + downstream consumption. Written first. |
| **IV. Versioned Contract** | All routes under `/api/v1`. Reuse `{ data, meta, message }` envelope + error shape (`ApiResponse`/`ApiController`). Audit + export lists use the same pagination meta as existing index endpoints. |
| **V. Security by Default** | This phase **is** the security pass: every endpoint authenticated + `permission:`-gated (incl. the new ones — `roles.manage`, `settings.manage`, `audit.view`, `export.*`); ungated-endpoint sweep closes gaps; explicit `$fillable`/`$hidden` review (esp. `User`, `Setting`); `config/cors.php` locked to dashboard origin; throttle on login (`auth`), POS (`sensitive`), export (`sensitive`/new `export` limiter); export links signed + user-scoped; bindings only (Spatie/query-builder); no secrets in code. |
| **VI. Performance** | Audit viewer eager-loads `causer`+`subject`, paginated, filtered via indexed columns; final index-review migration tops up `activity_log` + any flagged module columns; large exports **queued** (FR-019) — never inline; existing Redis dashboard cache retained. No N+1 introduced. |
| **VII. YAGNI** | No repository pattern; Actions over ceremony. Reuse Spatie models for custom roles (no custom role engine). One generic `/export/{resource}` rather than six bespoke export endpoints. Reuse existing `StoreSetting`. No frontend. No speculative permission granularity beyond what endpoints need. |

**Gate Result**: **PASS**. No violations. (See Complexity Tracking — empty.)

## Current-State Findings (grounds this plan in the real repo)

A survey of the repo (not just the phase doc) established that **Phases 0–3 are already implemented** — contrary to the stale "Phase 0 not done" note in `CLAUDE.md`. Concretely:

- **Packages**: all seven (sanctum, spatie permission/activitylog/query-builder, maatwebsite/excel, dompdf, pest) are in `composer.json`.
- **Permissions**: four support classes exist — `FoundationPermissions` (roles + `foundation.access-sample`), `MembershipPermissions`, `PosPermissions`, `HrFinancePermissions` — each with `ALL_PERMISSIONS`. Five roles (Admin/Manager/Cashier/Captain/Accountant) are defined in `FoundationPermissions::ALL_ROLES`. Per-module seeders (`FoundationAccessSeeder`, `MembershipAccessSeeder`, `PosAccessSeeder`, `HrFinanceAccessSeeder`) assign permissions to roles and are wired in `DatabaseSeeder`.
- **Audit**: `LogsActivity` is on 11 models (Member, Plan, Subscription, Payment, Product, Sale, InventoryMovement, Employee, Commission, Payroll, Expense). **Gaps**: `SaleItem`, `SubscriptionFreeze`, `Setting`, `User` lack it — Phase 4 decides per-model whether each *should* be audited (see research.md) and closes the intended ones. **No `/audit-logs` endpoint exists yet.**
- **Settings**: `settings` table + `Setting` model (key→array JSON) + `Actions/Settings/StoreSetting` (upsert/read) exist; `reminder_days` is read by `Actions/Reminders/FindExpiringSubscriptions`. **No `/settings` endpoint exists yet** (only the Action).
- **Export**: **nothing exists** — no `app/Exports/`, no export routes/controllers. Greenfield within this phase.
- **Rate limiters**: `auth` (10/min by IP), `sensitive` (10/min by user/IP), `api` (60/min) defined in `AppServiceProvider`. POS/sales currently use `throttle:api` — the security pass tightens write/sensitive endpoints.
- **CORS**: **`config/cors.php` does not exist** — must be published/added and locked to the dashboard origin (FR-028).
- **Envelope**: `ApiController` + `ApiResponse` provide `success()`/`error()`; routes split into `routes/api/*.php` required inside the single `/api/v1` auth group.

**Implication**: Phase 4 is genuinely a *consolidation* phase. The bulk of effort is: (a) Role/Permission/Settings/Audit **API surfaces** over existing data, (b) the **export subsystem** (the one greenfield piece), (c) the **completeness sweeps** (ungated endpoints, `LogsActivity` gaps, index review, CORS, throttling).

## Cross-Phase Contract Consumption (this phase consumes everything)

1. **Permissions per module** (`members.*`, `plans.*`, `subscriptions.*`, `payments.*`, `products.*`, `sales.*`, `inventory.*`, `reports.*`, `employees.*`, `commissions.*`, `payroll.*`, `expenses.*`, `dashboard.view`, `notifications.view`, `foundation.*`) → consolidated into the **final matrix** exposed by `GET /permissions` and folded into the five role presets by `RoleMatrixSeeder`. New cross-cutting permissions added here: `roles.manage`, `settings.manage`, `audit.view`, `export.*` (one per exportable resource, mapped to the resource's existing view permission — see research.md).
2. **Audit** — every model carrying `LogsActivity` is surfaced through `GET /audit-logs`. No change to how earlier phases log; only read + filter + gap-fill.
3. **Export** — each resource's existing index filters (the `spatie/laravel-query-builder` `AllowedFilter` sets already on Member/Employee/Expense controllers, and the report query params) are reused so an export matches the on-screen list (FR-017).
4. **Settings** — `reminder_days` (consumed by P1 reminders) and VAT/receipt (consumed by P2 receipts) are finalized behind `GET/PUT /settings`; the existing `StoreSetting` Action is reused.

## Project Structure

### Documentation (this feature)

```text
specs/005-permissions-audit-branding/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions & rationale
├── data-model.md        # Phase 1 — entities (no new tables), settings keys, audit shape, index review
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/
│   └── api.md           # Phase 1 — endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist (done)
└── tasks.md             # Phase 2 — created by /speckit-tasks (NOT here)
```

### Source Code (additions only — no new business tables)

```text
app/
├── Actions/
│   ├── Roles/              # StoreRole, UpdateRole, DeleteRole, SyncUserRoles
│   ├── Settings/           # UpdateSettings (reuses existing StoreSetting)
│   └── Export/             # BuildExport (resolve resource → filtered query/dataset)
├── Jobs/                   # GenerateExportJob (queued large export → stored file + signed link)
├── Exports/                # MembersExport, SubscriptionsExport, SalesExport,
│                           #   PaymentsExport, PayrollExport, ReportExport
│                           #   (maatwebsite FromQuery/WithHeadings; PDF via dompdf view)
├── Http/
│   ├── Controllers/Api/V1/ # RoleController, PermissionController, UserRoleController,
│   │                       #   SettingController, AuditLogController, ExportController
│   ├── Requests/
│   │   ├── Roles/          # StoreRoleRequest, UpdateRoleRequest, SyncUserRolesRequest
│   │   ├── Settings/       # UpdateSettingsRequest
│   │   └── Export/         # ExportRequest (validate resource + format + filters)
│   └── Resources/          # RoleResource, PermissionResource, SettingResource,
│                           #   AuditLogResource
├── Models/                 # additive only: add LogsActivity to intended gap models
│                           #   (SubscriptionFreeze, SaleItem? — per research); $hidden review on User
├── Policies/               # RolePolicy (manage), SettingPolicy, AuditLogPolicy
│                           #   (export authorized via per-resource permission, not a policy)
└── Support/                # SystemPermissions (roles.manage, settings.manage, audit.view,
                            #   export.* map), PermissionMatrix (aggregates all *Permissions classes)

bootstrap/ or config/
└── cors.php                # NEW — published & locked to the dashboard origin (FR-028)

database/
├── migrations/             # add_indexes_to_activity_log (+ any flagged module index top-ups)
└── seeders/                # RoleMatrixSeeder — consolidated final preset→permission matrix
                            #   across ALL modules; called from DatabaseSeeder after module seeders

routes/
└── api/
    ├── roles.php           # /roles CRUD, /permissions, /users/{id}/roles
    ├── settings.php        # /settings GET, PUT
    ├── audit.php           # /audit-logs (filtered, paginated)
    └── export.php          # /export/{resource} (queued for large; throttled)
    # all required in routes/api.php inside the /api/v1 auth group

tests/
├── Feature/Api/V1/
│   ├── Roles/              # RoleCrudTest, CustomRoleEnforcementTest, UserRolesTest,
│   │                       #   PermissionsCatalogTest, RoleLockoutGuardTest
│   ├── Settings/           # SettingsReadUpdateTest, SettingsValidationTest,
│   │                       #   SettingsDownstreamTest (reminder_days/VAT consumed)
│   ├── Audit/              # AuditLogFilterTest, AuditLogAuthzTest
│   └── Export/             # ExportFormatsTest, ExportQueuedTest, ExportPermissionTest,
│                           #   ExportValidationTest
└── Feature/Security/
    └── EndpointGatingSweepTest.php   # SC-001: every non-public route has auth + permission
```

**Structure Decision**: Single Laravel project, extending the Phase 0–3 layout. New `Actions/Roles|Export`, `Jobs/`, `Exports/` namespaces parallel the existing `Actions/*` convention. `SystemPermissions` + `PermissionMatrix` sit alongside the four existing `*Permissions` classes. `RoleMatrixSeeder` runs **after** the module seeders in `DatabaseSeeder` to finalize the consolidated presets (the module seeders remain the source of per-module permission *registration*; the matrix seeder owns the final preset *composition*). No Phase 0–3 model/Action is modified except additive `LogsActivity` traits and `$hidden` hardening.

## Export Subsystem — design decision (the one greenfield piece)

The phase requires one generic exporter across six resources in three formats, permission-respecting, queued for large data.

- **Routing**: a single `GET /export/{resource}` where `{resource} ∈ {members, subscriptions, sales, payments, payroll, reports}`, `?format=xlsx|csv|pdf`, plus the same filter query-params the resource's index accepts. `ExportRequest` validates the resource enum, format enum, and delegates filter validation to reuse.
- **Authorization**: `export.{resource}` permission, seeded to map 1:1 to the resource's existing **view** permission holders (so "can export" ≡ "can view"; FR-018). Implemented as a `permission:` middleware resolved from the route param via a small map in `SystemPermissions`.
- **Build**: `BuildExport` resolves `{resource}` → the module's filtered Eloquent query (reusing the resource's `AllowedFilter` set), returning a `maatwebsite` export object (`FromQuery` + `WithHeadings` + `WithMapping`) for xlsx/csv, or a dompdf view payload for pdf.
- **Sync vs queued**: row-count threshold (config, e.g. 5 000). Under threshold → stream the download immediately (`Excel::download` / `Pdf::download`). Over threshold → dispatch `GenerateExportJob` to the queue, store the file to a private disk, return `202 Accepted` with a job/handle; a follow-up `GET /export/{resource}?... ` status or a stored-file download via **signed temporary URL** retrieves it (FR-019). Tests use `Queue::fake()` to prove dispatch since the test env runs `sync`.
- **Audit**: each export request writes an activity-log entry (causer + resource + format); job failures land in `failed_jobs` and log a security/business event (FR-021).
- **Rejected**: six bespoke export endpoints/controllers — violates YAGNI and duplicates filter wiring six times. One parameterized resolver with a per-resource Export class is the minimal correct design.

## Permission Matrix Consolidation — design decision

- **Single catalog** (`GET /permissions`): `PermissionMatrix::all()` aggregates `FoundationPermissions::ALL_PERMISSIONS + MembershipPermissions::ALL_PERMISSIONS + PosPermissions::ALL_PERMISSIONS + HrFinancePermissions::ALL_PERMISSIONS + SystemPermissions::ALL_PERMISSIONS`, grouped by module prefix for the matrix UI. Source of truth stays the PHP constants (seeded into the `permissions` table); the endpoint reads the seeded `Permission` rows so custom additions are visible too.
- **Final presets** (`RoleMatrixSeeder`): the authoritative preset→permission composition for Admin (all), Manager (operational minus destructive system config), Cashier (POS + members read/create), Captain (own performance + members read), Accountant (finance/reports/expenses/payroll-view + export of those). Exact matrix in research.md/data-model.md. Idempotent `givePermissionTo`.
- **Custom roles**: `POST/PUT/DELETE /roles` over Spatie's `Role` with a validated permission list; assignment via `POST /users/{id}/roles`. Spatie's cache is forgotten on write so changes take effect without re-login (FR-006).
- **Lock-out guard** (FR-008): `DeleteRole`/`UpdateRole` and `SyncUserRoles` refuse any change that would leave zero users holding `roles.manage` — enforced in the Action with a count check, covered by `RoleLockoutGuardTest`.
- **Ungated sweep** (SC-001): `EndpointGatingSweepTest` enumerates `Route::getRoutes()` under `api/v1`, excludes the documented public set (`health`, `auth/login`), and asserts each remaining route has both `auth:sanctum` and a `permission:` middleware. This test makes "no endpoint ungated" executable and is expected to surface real gaps in P0–P3 routes to fix.

## Implementation Phasing (maps to spec user stories)

1. **Foundational**: `SystemPermissions` (`roles.manage`, `settings.manage`, `audit.view`, `export.*` map) + `PermissionMatrix` aggregator; `RoleMatrixSeeder` (consolidated presets) wired into `DatabaseSeeder`; `config/cors.php` locked to dashboard origin; add `export` rate limiter / tighten POS+export throttles; index-review migration for `activity_log`.
2. **US1 Permissions & Roles** (P1): `PermissionController@index` (catalog), `RoleController` CRUD + `RolePolicy`, `UserRoleController` (assign), Form Requests, Resources, `Actions/Roles/*` with lock-out guard, Spatie cache-forget on writes. `EndpointGatingSweepTest` + fix any ungated P0–P3 routes it finds.
3. **US2 Audit log** (P1): `AuditLogController@index` over Spatie `Activity` with query-builder filters (subject/causer/date), pagination, eager-load, `audit.view` gate, `AuditLogResource`; close `LogsActivity` gaps on intended models (per research.md).
4. **US3 Export** (P2): `ExportController` + `ExportRequest` + `BuildExport` + six `Exports/*` classes + `GenerateExportJob` + signed-link retrieval; per-resource permission gate; queued-threshold logic; export audit entry; throttle.
5. **US4 Settings & branding** (P2): `SettingController` GET/PUT + `UpdateSettingsRequest` (validation rules) + `UpdateSettings` Action (reusing `StoreSetting`) + `SettingResource`; confirm downstream consumption (reminder_days, VAT/receipt). `settings.manage` gate; audit on change.
6. **US5 Responsive/RTL QA**: **frontend — out of scope for backend**; documented as a manual QA checklist handed to the dashboard team (quickstart references it). Backend ensures empty/error/loading states are *supported* by consistent envelope + correct status codes.
7. **Hardening pass**: mass-assignment/`$hidden` review (esp. `User`, `Setting`); final index/slow-query review across all modules; Pint; full Pest suite green; review gates.

## Review Gates (mandatory workflow — CLAUDE.md)

1. Analyze requirements against Phase 4 doc + Constitution. ✅ (this plan)
2. `laravel-architecture-reviewer` **before** writing code.
3. `laravel-feature-engineer` — test-first implementation.
4. Full Pest suite green.
5. `laravel-security-reviewer` (this phase **is** the security pass — heaviest focus: gating sweep, CORS, throttling, export link signing, `$hidden`).
6. `laravel-performance-reviewer` (final index review, audit-viewer N+1, queued export).
7. `laravel-code-reviewer` + `release-readiness-auditor` (final gate). `database-schema-reviewer` on the index migration; `api-contract-reviewer` on the six new endpoints.

## Out of Scope

- **All frontend**: `/settings` UI (roles matrix, branding, system settings), `/audit-logs` viewer, export buttons, ATP theme tokens/logo rendering, and the **responsive/RTL QA sweep** (US5) — these are dashboard deliverables. The backend delivers the APIs, gating, audit, export, and settings they consume, plus a documented QA checklist.
- **New business features** — none; system is feature-complete after Phase 3 (per phase doc §2).
- **New business tables** — none; only `settings`/`activity_log` (existing) + an index-review migration.
- **Receipt-template rendering engine** — the template is stored/validated as a setting; actual receipt generation belongs to P2 and is only *fed* by the finalized setting.
- **Per-row export field customization / scheduled exports** — YAGNI; on-demand export of the existing filtered view only.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | N/A | N/A |
