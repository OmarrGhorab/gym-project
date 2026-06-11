# Tasks: Permissions Matrix, Audit, Export & Branding (Phase 4)

**Input**: Design documents from `/specs/005-permissions-audit-branding/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: Required by the Constitution (Test-First with Pest). Write the failing Pest test first, watch it fail, then implement to green.

**Scope note**: Per the requester, **all frontend tasks are excluded** — no `/settings` UI, roles-matrix UI, branding/logo upload UI, `/audit-logs` viewer UI, export buttons, ATP theme tokens, or responsive/RTL page work. US5 is therefore delivered as the **backend-enabling contract + a documented manual QA checklist** only (already in `quickstart.md`). The backend exposes every API the dashboard will consume.

**Conventions**: No new packages (all installed in Phase 0). Explicit `$fillable`/`$hidden`; authorization in Policies/`permission:` middleware; validation in Form Requests; logic in Actions (typed args, never the Request); responses via API Resources; all routes under `/api/v1`; eager-load to avoid N+1; index every FK/queried/ordered column; heavy work (large export) **queued**; one `{ data, meta, message }` envelope + stable error shape; Spatie guard `web`. Run tooling with the project PHP (8.4 confirmed).

---

## Phase 1: Setup (Shared Dependencies)

**Purpose**: No new packages — verify, scaffold route files, run the architecture review before code.

- [x] T001 Verify Phase 0–3 packages present via `composer show` (`laravel/sanctum`, `spatie/laravel-permission`, `spatie/laravel-activitylog`, `spatie/laravel-query-builder`, `maatwebsite/excel`, `barryvdh/laravel-dompdf`, `pestphp/pest`); confirm nothing to install.
- [x] T002 Run and record the pre-implementation architecture review (`laravel-architecture-reviewer`) in `specs/005-permissions-audit-branding/reviews/architecture.md`. Block on any BLOCKER findings before Phase 2.
- [x] T003 Create per-area route files `routes/api/roles.php`, `routes/api/settings.php`, `routes/api/audit.php`, `routes/api/export.php` (comment-only stubs); register all four in the `auth:sanctum` `/api/v1` group in `routes/api.php` after the existing requires.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared cross-cutting infrastructure every story depends on. No story work begins until this phase is complete.

**⚠️ CRITICAL**: The new `SystemPermissions` constants, the `PermissionMatrix` aggregator, the consolidated `RoleMatrixSeeder`, the `activity_log` index migration, `config/cors.php`, and the `export` throttle must exist before story phases begin.

- [x] T004 Create `app/Support/SystemPermissions.php` with constants `roles.manage`, `settings.manage`, `audit.view`, and `export.{members,subscriptions,sales,payments,payroll,reports}`; an `ALL_PERMISSIONS` array; and a static `EXPORT_PERMISSION_MAP` (`resource ⇒ export.{resource}`) plus an `EXPORT_VIEW_PERMISSION_MAP` (`resource ⇒ existing view permission`, e.g. `members ⇒ members.view`, `reports ⇒ reports.view`) per research D5.
- [x] T005 [P] Create `app/Support/PermissionMatrix.php` with `all(): array` aggregating `FoundationPermissions::ALL_PERMISSIONS + MembershipPermissions::ALL_PERMISSIONS + PosPermissions::ALL_PERMISSIONS + HrFinancePermissions::ALL_PERMISSIONS + SystemPermissions::ALL_PERMISSIONS`, and `grouped(): array` keyed by module prefix (segment before the first dot; `system` for the SystemPermissions set).
- [x] T006 Create `database/seeders/RoleMatrixSeeder.php` that (a) registers all `SystemPermissions` via `firstOrCreate`, and (b) composes the **final preset matrix** from research D3 onto the five roles using `givePermissionTo` (idempotent); `export.{resource}` granted to a role iff it holds that resource's view permission. Clear Spatie cache at start.
- [x] T007 Wire `RoleMatrixSeeder` into `database/seeders/DatabaseSeeder.php` **last** (after `HrFinanceAccessSeeder`) so it finalizes preset composition over all module-registered permissions.
- [x] T008 [P] Create migration `database/migrations/*_add_indexes_to_activity_log_table.php` adding any missing indexes for the audit viewer filter+sort paths — at minimum `(created_at)` and `(causer_id, created_at)`; guard each `Schema` add with an existence check (Spatie ships some morph indexes); reversible `down()` drops exactly what `up()` added.
- [x] T009 Run `php artisan migrate`; confirm clean `migrate:rollback` on a scratch run.
- [x] T010 [P] Publish/create `config/cors.php` with `allowed_origins` resolved from `env('FRONTEND_URL')` (no `*`), `allowed_methods`/`allowed_headers` sensible defaults, `supports_credentials` true; add `FRONTEND_URL` to `.env.example`.
- [x] T011 [P] Add an `export` rate limiter in `app/Providers/AppServiceProvider::configureRateLimiters()` (e.g. `Limit::perMinute(5)->by(user|ip)`) — or document reuse of `sensitive`; this gate is applied to export routes in Phase 5.

**Checkpoint**: Permission catalog + final presets seeded, audit indexes in place, CORS locked, export throttle ready. Story phases can proceed.

---

## Phase 3: User Story 1 - Complete Permission Matrix with Roles (Priority: P1) 🎯 MVP

**Goal**: Surface the full permission catalog, role CRUD + presets + custom roles, and user-role assignment; enforce a permission on **every** non-public endpoint (close gaps); reflect role changes without re-login; prevent admin lock-out.

**Independent Test**: List permissions (200 Admin / 403 Cashier) → create a custom role with a subset → assign to a user → that user passes permitted actions and gets 403 elsewhere (no re-login) → deleting the last `roles.manage` role is refused (422) → the gating sweep test is green.

### Tests for US1

- [x] T012 [P] [US1] Failing feature tests for `GET /permissions` (200 grouped catalog as Admin; 403 without `roles.manage`; 401 unauth) in `tests/Feature/Api/V1/Roles/PermissionsCatalogTest.php`.
- [x] T013 [P] [US1] Failing feature tests for `GET/POST /roles` and `PUT/DELETE /roles/{role}` (200 list; 201 create; 200 update via `syncPermissions`; 204 delete; 422 duplicate name / unknown permission; 404; 403) in `tests/Feature/Api/V1/Roles/RoleCrudTest.php`.
- [x] T014 [P] [US1] Failing feature tests for `POST /users/{user}/roles` (200 assign; 422 unknown role; 404 user; 403) and that a newly granted permission is honored on the next request **without re-login** (FR-006) in `tests/Feature/Api/V1/Roles/UserRolesTest.php`.
- [x] T015 [P] [US1] Failing feature tests for the lock-out guard (FR-008): deleting/editing the last role granting `roles.manage`, or removing it from the last holding user, returns 422 in `tests/Feature/Api/V1/Roles/RoleLockoutGuardTest.php`.
- [x] T016 [P] [US1] Failing feature test `SC-001`: enumerate `Route::getRoutes()` filtered to `api/v1/*`, subtract the public allowlist (`health`, `auth/login`), assert each remaining route has both `auth:sanctum` and a `permission:`/`role:`/`can:` gate in `tests/Feature/Security/EndpointGatingSweepTest.php`.
- [x] T017 [P] [US1] Failing feature test asserting preset composition (SC-003): after seeding, each of Admin/Manager/Cashier/Captain/Accountant holds exactly the research-D3 permission set in `tests/Feature/Roles/RolePresetMatrixTest.php`.

### Implementation for US1

- [x] T018 [P] [US1] Create `app/Policies/RolePolicy.php` (viewAny/view/create/update/delete + assign → all mapped to `roles.manage`); register if not auto-discovered.
- [x] T019 [P] [US1] Create `app/Http/Resources/PermissionResource.php` and `app/Http/Resources/RoleResource.php` (`{ id, name, permissions: [name...], is_preset }`; `is_preset` = name ∈ `FoundationPermissions::ALL_ROLES`).
- [x] T020 [P] [US1] Create `app/Http/Requests/Roles/StoreRoleRequest.php` (authorize via policy; `name` required/unique on `roles`; `permissions` array, each `exists` in the seeded permissions / `PermissionMatrix::all()`).
- [x] T021 [P] [US1] Create `app/Http/Requests/Roles/UpdateRoleRequest.php` (same rules; `name` unique excluding current role).
- [x] T022 [P] [US1] Create `app/Http/Requests/Roles/SyncUserRolesRequest.php` (`roles` array, each `exists` on `roles.name`).
- [x] T023 [US1] Create `app/Actions/Roles/StoreRole.php` (create `Role`, `syncPermissions`, forget Spatie cache).
- [x] T024 [US1] Create `app/Actions/Roles/UpdateRole.php` (`syncPermissions`; **lock-out guard**: refuse if change removes the last `roles.manage` source; forget cache; log a curated audit entry — FR-009).
- [x] T025 [US1] Create `app/Actions/Roles/DeleteRole.php` (refuse deleting a preset; **lock-out guard**; forget cache; audit entry).
- [x] T026 [US1] Create `app/Actions/Roles/SyncUserRoles.php` (`syncRoles` on the user; **lock-out guard** so no change orphans all `roles.manage` access; forget cache; audit entry).
- [x] T027 [US1] Create `app/Http/Controllers/Api/V1/PermissionController.php` (`index` → `PermissionMatrix::grouped()` via `PermissionResource`/array; thin).
- [x] T028 [US1] Create `app/Http/Controllers/Api/V1/RoleController.php` (`index/store/show/update/destroy`; validate → authorize → Action → `RoleResource`; eager-load `permissions`).
- [x] T029 [US1] Create `app/Http/Controllers/Api/V1/UserRoleController.php` (`store` assign roles to user; returns user + roles; `$hidden` on User respected — see T058).
- [x] T030 [US1] Wire routes in `routes/api/roles.php`: `GET /permissions`, `apiResource('roles')`, `POST /users/{user}/roles`; gate all with `permission:roles.manage`; `throttle:api` on writes.
- [x] T031 [US1] Run the SC-001 sweep (T016); **fix every ungated P0–P3 route it surfaces** by adding the correct `permission:` middleware in the relevant `routes/api/*.php` file; re-run until green.

**Checkpoint**: Permission catalog, role CRUD, custom roles, assignment, lock-out guard, and full-endpoint gating all functional and tested.

---

## Phase 4: User Story 2 - Audit Log Viewer (Priority: P1)

**Goal**: Surface `activity_log` through `GET /audit-logs` with subject/causer/date-range filters, pagination, newest-first, eager-loaded causer/subject; close intended `LogsActivity` gaps; gate behind `audit.view`.

**Independent Test**: Perform recorded actions → list shows who/what/when newest-first → filter by causer + date range narrows correctly → `from > to` → 422 → unknown subject alias → 422 → without `audit.view` → 403.

### Tests for US2

- [x] T032 [P] [US2] Failing feature tests for `GET /audit-logs` (200 paginated, newest-first; `filter[subject]` alias narrows; `filter[causer]` narrows; `filter[from]`+`filter[to]` range; combined filters) in `tests/Feature/Api/V1/Audit/AuditLogFilterTest.php`.
- [x] T033 [P] [US2] Failing feature tests for audit authz/validation (`403` without `audit.view`; `401` unauth; `422` on `from > to`; `422` on unknown subject alias) in `tests/Feature/Api/V1/Audit/AuditLogAuthzTest.php`.
- [x] T034 [P] [US2] Failing feature test that creating/updating a `SubscriptionFreeze` produces an audit entry, and that a settings change + a role change appear in the log (FR-009) in `tests/Feature/Api/V1/Audit/AuditCoverageTest.php`.

### Implementation for US2

- [x] T035 [P] [US2] Add `LogsActivity` (with `getActivitylogOptions`, `useLogName('subscription_freeze')`) to `app/Models/SubscriptionFreeze.php` per research D4; do **not** add the trait to `User`/`Setting`/`SaleItem` (curated Action-level logging instead).
- [x] T036 [P] [US2] Create `app/Http/Resources/AuditLogResource.php` (`{ id, action, subject: {type: alias, id}, causer: {id, name}|null, causer_type, changes, created_at }`; map `subject_type` FQCN → friendly alias; `causer_type: "system"` when causer null).
- [x] T037 [US2] Create a subject-alias map (e.g. in `AuditLogController` or a small `Support/AuditSubjects.php`): `member ⇄ App\Models\Member`, `subscription`, `sale`, `payment`, `payroll`, `commission`, `employee`, `expense`, `product`, `plan`, `subscription_freeze`.
- [x] T038 [US2] Create `app/Http/Controllers/Api/V1/AuditLogController.php` `index`: `QueryBuilder::for(Activity::class)` with `AllowedFilter`s — `subject` (custom: alias → `subject_type` exact), `causer` (`causer_id` exact), `from`/`to` (custom date-range, validate `from ≤ to` → 422); default sort `-created_at`; eager-load `causer`+`subject`; paginate; return `AuditLogResource` collection; gate `permission:audit.view`.
- [x] T039 [US2] Wire `GET /audit-logs` in `routes/api/audit.php` with `permission:audit.view`.

**Checkpoint**: Audit viewer functional with all filters, pagination, authz, and gap-fill coverage.

---

## Phase 5: User Story 3 - Universal Data Export (Priority: P2)

**Goal**: One `GET /export/{resource}` for members/subscriptions/sales/payments/payroll/reports → xlsx/csv/pdf, honoring each resource's index filters, gated per-resource, **queued** above a row threshold with a signed-URL download; each request audited.

**Independent Test**: Export each resource in each format; contents match the filtered list → over-threshold dataset returns 202 + dispatches `GenerateExportJob` (`Queue::fake()`) and yields a signed download → user lacking `export.{resource}` → 403 → unknown resource/format → 422.

### Tests for US3

- [x] T040 [P] [US3] Failing feature tests for `GET /export/members` in all three formats (200 download; correct `Content-Type`/`Content-Disposition`; rows match an applied `filter[...]`) using `Excel::fake()` in `tests/Feature/Api/V1/Export/ExportFormatsTest.php`.
- [x] T041 [P] [US3] Failing feature tests for queued behavior (FR-019): over-threshold dataset → 202 + `Queue::fake()->assertPushed(GenerateExportJob)`; the job writes a file retrievable via a signed temporary URL in `tests/Feature/Api/V1/Export/ExportQueuedTest.php`.
- [x] T042 [P] [US3] Failing feature tests for export authz (SC-008): `403` without `export.{resource}` for each resource; `401` unauth in `tests/Feature/Api/V1/Export/ExportPermissionTest.php`.
- [x] T043 [P] [US3] Failing feature tests for validation (`422` unknown `{resource}`, `422` unsupported `format`) and that each request writes an audit entry (FR-021) in `tests/Feature/Api/V1/Export/ExportValidationTest.php`.

### Implementation for US3

- [x] T044 [P] [US3] Add `config/export.php` (`sync_threshold` default 5000, `disk` `local`/private, `retention_hours` default 24) and reference `env` where appropriate.
- [x] T045 [P] [US3] Create `app/Exports/MembersExport.php`, `SubscriptionsExport.php`, `SalesExport.php`, `PaymentsExport.php`, `PayrollExport.php` implementing maatwebsite `FromQuery`, `WithHeadings`, `WithMapping`; each builds its query by reusing the resource's existing `AllowedFilter` set (members/subscriptions/sales/payments/payroll). Eager-load relations rendered in columns.
- [x] T046 [P] [US3] Create `app/Exports/ReportExport.php` wrapping the Phase 3 report aggregates (financial/performance) rather than a raw model query, honoring report query params.
- [x] T047 [P] [US3] Create a PDF view `resources/views/exports/{resource}.blade.php` (generic table layout) rendered via dompdf for `format=pdf`.
- [x] T048 [US3] Create `app/Actions/Export/BuildExport.php`: typed inputs (`string $resource`, `string $format`, `array $filters`); resolve `{resource}` → the matching Export class / query; return a streamable response for small datasets or hand the query spec to the job for large ones; count rows to decide sync vs queued against `export.sync_threshold`.
- [x] T049 [US3] Create `app/Jobs/GenerateExportJob.php` (queued; builds the export to a file on the private disk at `exports/{uuid}.{ext}`; on success stores metadata for signed-URL retrieval; on failure logs a security/business event and lands on `failed_jobs` — FR-021). Set timeout + retry/backoff.
- [x] T050 [P] [US3] Create `app/Http/Requests/Export/ExportRequest.php` (authorize via the per-resource permission resolved from the route param using `SystemPermissions::EXPORT_PERMISSION_MAP`; `format` `in:xlsx,csv,pdf`; `{resource}` validated against the allowed set; delegate filter validation to reuse).
- [x] T051 [US3] Create `app/Http/Controllers/Api/V1/ExportController.php`: `__invoke`/`show` → validate (`ExportRequest`) → call `BuildExport` → return streamed download (200) or `202 Accepted` `{ export_id, status: "processing" }`; write the per-request audit entry (causer + resource + format).
- [x] T052 [US3] Create the signed download route + handler (e.g. `GET /export/download/{export}` with `signed` middleware) returning the completed file or `404/410` if missing/expired; user-scoped.
- [x] T053 [US3] Wire routes in `routes/api/export.php`: `GET /export/{resource}` with dynamic `permission:export.{resource}` (resolve via map) + `throttle:export` (or `sensitive`); plus the signed download route.
- [x] T054 [P] [US3] Add a scheduled cleanup (console command or scheduler closure) pruning export files older than `retention_hours`; register in `routes/console.php`/scheduler.

**Checkpoint**: Generic export works for all six resources in all three formats, queued for large data, permission-gated, audited, with signed retrieval.

---

## Phase 6: User Story 4 - System Settings & Branding (Priority: P2)

**Goal**: `GET/PUT /settings` over the existing `settings` table for the seven curated keys, validated, gated by `settings.manage`, audited on change, and consumed by P1 reminders + P2 receipts. (Branding values are stored/served; the **UI** that renders them is out of scope.)

**Independent Test**: Read settings → update each field → read back persists → invalid values (negative reminder_days, VAT > 100) → 422 → non-Admin → 403 → updated `reminder_days` consumed by the reminder finder.

### Tests for US4

- [x] T055 [P] [US4] Failing feature tests for `GET /settings` (200 current curated keys with null defaults) and `PUT /settings` (200 persists; read-back matches; 403 non-`settings.manage`; 401) in `tests/Feature/Api/V1/Settings/SettingsReadUpdateTest.php`.
- [x] T056 [P] [US4] Failing feature tests for validation (422 on `reminder_days:-1`, `vat_rate:120`, malformed `gym.colors.*` hex, bad `currency` size, oversized/invalid `gym.logo`) in `tests/Feature/Api/V1/Settings/SettingsValidationTest.php`.
- [x] T057 [P] [US4] Failing feature tests for downstream consumption (SC-009): updated `reminder_days` is picked up by `Actions/Reminders/FindExpiringSubscriptions`; `vat_rate`/`receipt_template` are readable by the P2 receipt path; and a settings change writes an audit entry (FR-026) in `tests/Feature/Api/V1/Settings/SettingsDownstreamTest.php`.

### Implementation for US4

- [x] T058 [US4] Review `app/Models/User.php` `$hidden` (ensure `password`, `remember_token` hidden) and `app/Models/Setting.php` (no sensitive leakage) — hardening prerequisite for settings/user-roles responses (supports FR-014/V).
- [x] T059 [P] [US4] Create `app/Policies/SettingPolicy.php` (view/update → `settings.manage`) or gate via `permission:settings.manage` middleware (pick one consistently; document).
- [x] T060 [P] [US4] Create `app/Http/Resources/SettingResource.php` shaping the seven keys into `{ gym: {name, colors, logo}, reminder_days, currency, vat_rate, receipt_template }` with null-safe defaults.
- [x] T061 [P] [US4] Create `app/Http/Requests/Settings/UpdateSettingsRequest.php` with per-key rules from research D8 (`reminder_days` int min:0; `vat_rate` numeric between:0,100; `currency` size:3 in allowed list; `gym.name` max:255; `gym.colors.*` hex regex; `gym.logo` image mimes+max or string; `receipt_template` string max). Authorize via `settings.manage`.
- [x] T062 [US4] Create `app/Actions/Settings/UpdateSettings.php` accepting a validated typed array, upserting each provided key via the existing `StoreSetting`, writing one curated audit entry (FR-026); handle `gym.logo` file storage to a public/branding disk when an upload is provided.
- [x] T063 [US4] Create `app/Http/Controllers/Api/V1/SettingController.php` (`index` → `SettingResource`; `update` → `UpdateSettingsRequest` → `UpdateSettings` → `SettingResource`); thin.
- [x] T064 [US4] Wire `GET /settings` + `PUT /settings` in `routes/api/settings.php` with `permission:settings.manage`; `throttle:api` on update.

**Checkpoint**: Settings readable/updatable, validated, gated, audited, and consumed downstream.

---

## Phase 7: User Story 5 - Backend Contract for Responsive/RTL QA (Priority: P3)

**Goal** (backend-only slice; frontend QA excluded per scope): guarantee the API contract that *enables* good empty/loading/error and RTL-agnostic states — consistent envelope, correct status codes, paginated and empty-safe list responses — and hand the dashboard team the documented manual QA checklist.

**Independent Test**: An empty list returns `200` with empty `data` (not an error); an unauthorized call returns `403` (distinguishable from `401`/`422`); paginated lists carry consistent `meta`.

### Tests for US5

- [x] T065 [P] [US5] Failing feature test that representative list endpoints (e.g. `GET /members`, `GET /audit-logs`, `GET /roles`) return `200` + empty `data` + pagination `meta` when no records exist (empty-state contract) in `tests/Feature/Api/V1/Contract/EmptyStateContractTest.php`.
- [x] T066 [P] [US5] Failing feature test asserting the stable error shape + correct status codes are distinguishable across `401`/`403`/`404`/`422` for a sampled endpoint in `tests/Feature/Api/V1/Contract/ErrorShapeContractTest.php`.

### Implementation for US5

- [x] T067 [US5] Verify/adjust the envelope + error handler so empty collections and each error class emit the documented shapes/codes (fix any inconsistency the T065/T066 tests reveal); no new endpoints.
- [x] T068 [US5] Confirm the manual responsive/RTL QA checklist in `quickstart.md` is complete and reference it in `specs/005-permissions-audit-branding/reviews/` as the handoff artifact for the dashboard team. (No frontend implementation.)

**Checkpoint**: Backend contract proven to support the frontend's empty/loading/error/RTL states; QA checklist handed off.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, performance review, and gate sign-off across all stories.

- [x] T069 [P] Security pass: confirm CORS locked to `FRONTEND_URL`, login/`auth` + POS/`sensitive` + export throttles applied, export links signed+user-scoped+expiring, `$hidden` verified on every Resource; record findings via `laravel-security-reviewer` in `specs/005-permissions-audit-branding/reviews/security.md`.
- [x] T070 [P] Performance pass: confirm audit viewer eager-loads (no N+1), `activity_log` indexes used by the filter/sort paths, large export queued (never inline), existing Redis dashboard cache intact; final cross-module index/slow-query review via `laravel-performance-reviewer` in `specs/005-permissions-audit-branding/reviews/performance.md`.
- [x] T071 [P] `api-contract-reviewer` on the six new endpoints (envelope, status codes, pagination meta consistency) → `reviews/api-contract.md`; `database-schema-reviewer` on the `activity_log` index migration → `reviews/schema.md`.
- [x] T072 Run `vendor/bin/pint` and resolve all formatting issues.
- [x] T073 Run the full Pest suite (`php artisan test`); ensure green incl. the gating sweep, export, permissions, settings, and audit tests (SC-011).
- [x] T074 Update endpoint contract docs to match the implemented routes; ensure `contracts/api.md` and any per-endpoint docs are in sync.
- [x] T075 Final `laravel-code-reviewer` + `release-readiness-auditor` gate → `reviews/release-readiness.md`; resolve blockers.
- [x] T076 Execute `quickstart.md` backend validation scenarios (US1–US4 + US5 contract) end-to-end against a seeded DB.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories** (permissions/matrix/seeder/CORS/throttle/indexes).
- **User Stories (Phases 3–7)**: All depend on Foundational. US1 should land first (it closes the gating sweep and seeds presets the others rely on for authz tests).
- **Polish (Phase 8)**: Depends on all desired stories complete.

### User Story Dependencies

- **US1 (P1, Permissions/Roles)**: After Foundational. Provides the permission gates + presets the other stories' authz tests assert against → land first (MVP).
- **US2 (P1, Audit)**: After Foundational. Independent of US3/US4; uses `audit.view` seeded in Phase 2. Its coverage test (T034) references settings/role changes — run after US1/US4 land or stub the assertions to the events available.
- **US3 (P2, Export)**: After Foundational. Uses `export.*` perms (Phase 2) + each resource's existing filters (P0–P3). Independent of US2/US4.
- **US4 (P2, Settings)**: After Foundational. Independent of US2/US3. T058 (`$hidden`) also benefits US1's user-roles response.
- **US5 (P3, contract)**: After Foundational; best validated after US1–US4 endpoints exist (it samples them).

### Within Each User Story

- Tests (Pest) written first and failing → Resources/Requests/Policies (parallel) → Actions → Controllers → routes → integration.
- Models/Resources/Requests/Policies marked [P] are different files → parallelizable.

### Parallel Opportunities

- Phase 2: T005, T008, T010, T011 in parallel (T004 before T005/T006; T006 before T007).
- US1: T012–T017 (tests) parallel; then T018–T022 (policy/resources/requests) parallel; Actions T023–T026 sequential-ish (shared lock-out logic); controllers after.
- US3: T044–T047 + T050 parallel; T048/T049 after Export classes; controller/routes after.
- US4: T059–T061 parallel; Action/controller/routes after.
- Polish: T069–T071 parallel (different review docs).

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests first (they must fail):
Task: "PermissionsCatalogTest.php"
Task: "RoleCrudTest.php"
Task: "UserRolesTest.php"
Task: "RoleLockoutGuardTest.php"
Task: "EndpointGatingSweepTest.php"
Task: "RolePresetMatrixTest.php"

# Then the parallel scaffolding (different files):
Task: "RolePolicy.php"
Task: "PermissionResource.php + RoleResource.php"
Task: "StoreRoleRequest.php / UpdateRoleRequest.php / SyncUserRolesRequest.php"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational (CRITICAL — seeds presets, locks CORS, indexes).
2. Phase 3 US1 → **STOP and VALIDATE**: full permission matrix, custom roles, no ungated endpoints, lock-out guard. This alone closes the phase's primary security gap.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 (permissions/roles + gating sweep) → demo (MVP — security backbone).
3. US2 (audit viewer) → demo.
4. US3 (export) → demo.
5. US4 (settings/branding) → demo.
6. US5 (backend contract) + Polish → final hardening + review gates.

### Notes

- [P] = different files, no incomplete dependencies. [Story] label maps each task to its spec user story.
- **No frontend tasks** are included by request — APIs, gating, audit, export, settings, and the QA checklist are the deliverables; UI is a separate dashboard effort.
- Verify each Pest test fails before implementing. Run Pint before committing. Stop at any checkpoint to validate a story independently.
