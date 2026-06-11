# Phase 0 Research — Permissions Matrix, Audit, Export & Branding

All "NEEDS CLARIFICATION" from the technical context are resolved below. Each decision is grounded in the actual repository state (Phases 0–3 are already implemented) and the Constitution.

---

## D1 — Custom roles: Spatie models directly vs. a custom role abstraction

**Decision**: Use Spatie's `Role` and `Permission` Eloquent models directly via `Actions/Roles/*`. No wrapper, no repository.

**Rationale**: Constitution I & VII — Spatie already provides full role/permission CRUD, assignment, and caching. A custom abstraction would reimplement the framework. Custom roles are just `Role` rows with a chosen `permissions` set; `givePermissionTo`/`syncPermissions` cover it.

**Alternatives considered**: A `RoleService` facade over Spatie (rejected — single-implementation indirection); a bespoke `roles`/`role_permissions` schema (rejected — duplicates Spatie's tables).

---

## D2 — Where do role-permission *presets* live: per-module seeders vs. one consolidated seeder

**Decision**: Keep the existing per-module seeders responsible for **registering** each module's permissions (they already do, idempotently). Add **one** `RoleMatrixSeeder`, run last in `DatabaseSeeder`, that owns the **final composition** of the five presets across all modules. The four `*Permissions` support classes remain the source of truth for permission *names*.

**Rationale**: The phase explicitly says "consolidate the complete permission matrix" and "define final role presets." A single consolidation point makes the matrix auditable and prevents drift where each module seeder independently guesses preset membership. Module seeders stay (they register permissions so the catalog is complete even if matrix seeding is partial), but the authoritative preset→permission mapping is in one file.

**Alternatives considered**: Leaving preset composition scattered across four module seeders (rejected — no single source of truth for "what can a Cashier do?", drift risk, hard to review against SC-003). Replacing module seeders entirely (rejected — they also register permissions other phases depend on).

---

## D3 — Final preset → permission matrix (the authoritative composition)

**Decision** (seeded by `RoleMatrixSeeder`; `givePermissionTo`, idempotent):

| Module / Permission | Admin | Manager | Cashier | Captain | Accountant |
|---|---|---|---|---|---|
| `foundation.access-sample` | ✅ | | | | |
| `members.view` | ✅ | ✅ | ✅ | ✅ | |
| `members.create` | ✅ | ✅ | ✅ | | |
| `members.update` | ✅ | ✅ | ✅ | | |
| `members.delete` | ✅ | ✅ | | | |
| `plans.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `plans.create/update/delete` | ✅ | ✅ | | | |
| `subscriptions.view` | ✅ | ✅ | ✅ | ✅ | |
| `subscriptions.create/renew` | ✅ | ✅ | ✅ | | |
| `subscriptions.freeze/stop` | ✅ | ✅ | | | |
| `payments.view` | ✅ | ✅ | ✅ | | ✅ |
| `payments.create` | ✅ | ✅ | ✅ | | |
| `products.view` | ✅ | ✅ | ✅ | | ✅ |
| `products.create/update/delete` | ✅ | ✅ | | | |
| `sales.view` | ✅ | ✅ | ✅ | | ✅ |
| `sales.create` | ✅ | ✅ | ✅ | | |
| `sales.void` | ✅ | ✅ | | | |
| `inventory.adjust` | ✅ | ✅ | | | |
| `reports.view` | ✅ | ✅ | | | ✅ |
| `employees.view` | ✅ | ✅ | | | ✅ |
| `employees.create/update/delete` | ✅ | ✅ | | | |
| `commissions.view` | ✅ | ✅ | | ✅ | ✅ |
| `commissions.backfill` | ✅ | ✅ | | | |
| `payroll.view` | ✅ | ✅ | | | ✅ |
| `payroll.generate/pay` | ✅ | ✅ | | | |
| `expenses.*` | ✅ | ✅ | | | ✅ |
| `dashboard.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `notifications.view` | ✅ | ✅ | ✅ | | |
| `audit.view` | ✅ | ✅ | | | ✅ |
| `settings.manage` | ✅ | | | | |
| `roles.manage` | ✅ | | | | |
| `export.{members,subscriptions,sales,payments,payroll,reports}` | ✅ | per-view | per-view | per-view | per-view |

**Rationale**: Mirrors the access intent already encoded in the per-module seeders (e.g. Accountant = reports/expenses/payroll-view/commissions-view from `HrFinanceAccessSeeder`) and extends it sensibly: Admin owns system config (`settings.manage`, `roles.manage`); Manager runs operations but not system config; Cashier is POS+front-desk; Captain sees own performance + members; Accountant is finance/reporting. `export.{resource}` is granted iff the role holds the resource's view permission (D5).

**Alternatives considered**: Giving Manager `settings.manage`/`roles.manage` (rejected — system config is an Admin responsibility; least privilege). A single `export.all` permission (rejected — can't honor per-resource view gating, FR-018).

---

## D4 — Closing `LogsActivity` adoption gaps: which of the four un-traited models to audit

**Decision**: Add `LogsActivity` to **`SubscriptionFreeze`** (a member-impacting state change worth auditing). **Do NOT** add it to `SaleItem` (audited transitively via its parent `Sale`; per-line logging is noise), **`Setting`** is audited explicitly by the settings Action's activity log entry on change (FR-026 — logged at the Action with a clean description, not via the trait, to avoid logging every cast attribute), and **`User`** role/permission changes are audited by the role Actions (FR-009 security events) rather than blanket model logging that would capture `remember_token`/`password` churn.

**Rationale**: Constitution V (no secrets/PII in audit) — trait-logging `User` risks logging sensitive attribute diffs; explicit, curated logging at the Action is safer and clearer. `SaleItem` is a child of an already-audited aggregate. `SubscriptionFreeze` is a genuine standalone business event currently missing coverage.

**Alternatives considered**: Add the trait to all four (rejected — `User`/`Setting` secret/noise risk). Add to none (rejected — `SubscriptionFreeze` gap leaves a real state change unaudited).

---

## D5 — Export authorization model: per-resource permission vs. policy

**Decision**: A dedicated permission per exportable resource — `export.members`, `export.subscriptions`, `export.sales`, `export.payments`, `export.payroll`, `export.reports` — seeded to exactly the roles that hold the resource's **view** permission. The route resolves `{resource}` → permission via a static map in `SystemPermissions` and applies `permission:export.{resource}` middleware.

**Rationale**: FR-018 requires "the same permission required to view the underlying resource." Modeling export as its own permission (rather than reusing `members.view` directly) keeps export independently revocable while seeding it to mirror view-holders by default — satisfies the contract and stays flexible without extra code paths.

**Alternatives considered**: Reuse the resource's `view` permission directly on the export route (rejected — couldn't disable export without disabling viewing; the phase treats export as a distinct gated capability). A single `ExportPolicy` with a giant switch (rejected — `permission:` middleware + a map is thinner and consistent with the rest of the API).

---

## D6 — Sync vs. queued export threshold and retrieval

**Decision**: Row-count threshold (config `export.sync_threshold`, default 5 000). Below → immediate streamed download (`Excel::download`, `Pdf::download`). At/above → dispatch `GenerateExportJob`, write the file to a **private** disk (`storage/app/exports/{uuid}.{ext}`), return `202 Accepted` with an export handle; the completed file is retrieved via a **signed temporary URL** (user-scoped, time-limited). Completed files are pruned by a scheduled cleanup after a retention window (default 24h) — documented assumption from the spec.

**Rationale**: Constitution VI mandates queuing heavy work; FR-019 requires large exports not block the request. Signed temporary URLs (native Laravel) give secure, expiring, user-scoped retrieval without a new tokens table (YAGNI). Threshold keeps small exports instant (good UX) while protecting the request lifecycle.

**Testing note**: the test env runs the `sync` queue, so "is it queued?" is proven with `Queue::fake()`/`Bus::fake()` asserting `GenerateExportJob` was dispatched for an over-threshold dataset — not by observing async behavior. Excel content asserted with `Excel::fake()` + `assertDownloaded`.

**Alternatives considered**: Always-queue (rejected — poor UX for a 20-row export). Always-sync (rejected — violates FR-019/Constitution VI for large data). Public download URL (rejected — Constitution V; data exposure).

---

## D7 — Generic exporter shape (maatwebsite + dompdf)

**Decision**: `BuildExport` maps `{resource}` → a per-resource `Exports/{Resource}Export` class implementing maatwebsite's `FromQuery`, `WithHeadings`, `WithMapping` (so Excel/CSV stream from a query without loading all rows into memory). Each Export class reuses the resource's existing `spatie/laravel-query-builder` `AllowedFilter` set so the exported rows equal the filtered index (FR-017). For PDF, the same filtered query feeds a Blade view rendered by dompdf. `reports` export wraps the existing Phase 3 report aggregates rather than a raw model query.

**Rationale**: maatwebsite `FromQuery` is the memory-safe, framework-native path for large tabular exports and supports CSV + xlsx from one class. dompdf is already used for payslips. Reusing each module's `AllowedFilter` set avoids duplicating filter logic (DRY without premature abstraction).

**Alternatives considered**: `FromCollection` (rejected — loads everything in memory, defeats the large-export requirement). A bespoke CSV writer (rejected — reimplements the installed package). One mega Export class with a switch (rejected — per-resource heading/mapping differences make a class-per-resource cleaner and testable).

---

## D8 — Settings: schema, keys, and validation

**Decision**: Keep the existing key→JSON `settings` table and `StoreSetting` Action. Expose a curated set of keys via `GET/PUT /settings`, validated by `UpdateSettingsRequest`. `UpdateSettings` Action upserts each provided key through `StoreSetting`.

Settings keys (consumed downstream as noted):
- `gym.name` (string) — branding/identity.
- `gym.colors` (object: `primary`, `secondary`, `accent` — hex strings) — branding.
- `gym.logo` (string path/URL; upload validated for type+size) — branding.
- `reminder_days` (int ≥ 0) — **consumed by** `Actions/Reminders/FindExpiringSubscriptions` (P1).
- `currency` (ISO-4217 code string) — POS/receipts/reports display.
- `vat_rate` (number 0–100, percent) — **consumed by** P2 POS receipts.
- `receipt_template` (string/template body) — **consumed by** P2 receipts.

**Validation**: `reminder_days` integer min:0; `vat_rate` numeric between:0,100; `gym.colors.*` regex hex `#?[0-9a-fA-F]{6}`; `currency` size:3 / in: allowed list; `gym.logo` upload `image|max:` size or a string reference; `gym.name` string max:255; `receipt_template` string with a sane max length.

**Rationale**: Reuses existing infrastructure (Constitution I/VII). Curated keys + per-key validation prevent arbitrary settings injection. Downstream consumers already read `reminder_days`; VAT/receipt wiring is verified by `SettingsDownstreamTest`.

**Alternatives considered**: A typed `settings` columns migration (rejected — the flexible key→JSON store already exists and works; reshaping it is needless churn and a destructive migration). Free-form arbitrary keys via the API (rejected — Constitution V input validation; only known keys accepted).

---

## D9 — Audit viewer query + filters

**Decision**: `AuditLogController@index` queries Spatie's `Activity` model via `spatie/laravel-query-builder` with `AllowedFilter`s: `subject_type` (exact, mapped from a friendly alias e.g. `member` → `App\Models\Member`), `causer_id` (exact), and a `created_between`/`from`+`to` date-range filter (custom filter validating from ≤ to). Default sort `-created_at`, paginated. Eager-load `causer` and `subject` to avoid N+1. Gated by `audit.view`.

**Rationale**: query-builder is already the project's list-filtering convention (Member/Employee/Expense controllers). Eager-loading satisfies Constitution VI. Alias→FQCN mapping keeps the contract clean and avoids leaking internal class names while still filtering correctly.

**Edge case (from spec)**: `from > to` → 422 validation error (custom filter rule). System-caused entries (no `causer`) render `causer: null` with a `causer_type: "system"` hint in the resource.

**Alternatives considered**: Raw Eloquent with manual `when()` filters (rejected — inconsistent with the established query-builder convention). Exposing raw `subject_type` FQCNs (rejected — leaks internals; minor info-disclosure).

---

## D10 — Ungated-endpoint sweep (SC-001) as an executable test

**Decision**: `tests/Feature/Security/EndpointGatingSweepTest` enumerates `Route::getRoutes()`, filters to `api/v1/*`, subtracts a small explicit allowlist of public routes (`health`, `auth/login`), and asserts every remaining route's middleware contains both `auth:sanctum` and a `permission:*` (or `role:*`/`can:*`) gate. Gaps it finds in P0–P3 routes are fixed as part of US1.

**Rationale**: Makes "no endpoint is ungated" (FR-005, SC-001) machine-verifiable and regression-proof, rather than a manual claim. This is the security backbone of the phase.

**Alternatives considered**: Manual route audit (rejected — not regression-proof; the phase explicitly warns gating must cover every endpoint or it's a security gap).

---

## D11 — CORS and rate limiting (security pass)

**Decision**: Publish `config/cors.php` and set `allowed_origins` to the dashboard origin from env (`FRONTEND_URL`), not `*`. Add an `export` rate limiter (or reuse `sensitive`) and apply `throttle:sensitive` to POS sale creation and export; keep `throttle:auth` on login. Review write-heavy endpoints currently on `throttle:api` and tighten the genuinely sensitive ones.

**Rationale**: FR-027/FR-028, Constitution V. `config/cors.php` does not currently exist (Laravel 12 uses a published config or framework default `*`); locking it is a required hardening step. Env-driven origin keeps secrets/config out of code.

**Alternatives considered**: Leaving CORS at framework default `*` (rejected — FR-028). A custom throttling middleware (rejected — native `RateLimiter` suffices).

---

## D12 — Responsive/RTL QA (US5) handling in a backend-only deliverable

**Decision**: US5 is a **frontend** concern; the backend cannot render pages. Deliverable here is (a) a documented manual QA checklist (in `quickstart.md`) the dashboard team executes, and (b) backend guarantees that *enable* good frontend states: consistent envelope, correct status codes (so the UI can distinguish empty 200 vs 403 vs 422), and paginated/empty-safe list responses.

**Rationale**: Honest scoping per the project's API-first, backend-only nature. The spec's US5 acceptance scenarios are UI assertions; the backend's contribution is making them achievable.

**Alternatives considered**: Claiming US5 done in backend (rejected — dishonest; no UI exists here). Building a frontend (rejected — out of scope, separate deliverable).

---

## Summary of resolved unknowns

| # | Unknown | Resolution |
|---|---------|-----------|
| D1 | Custom-role implementation | Spatie models directly, no wrapper |
| D2 | Preset ownership | Module seeders register; one `RoleMatrixSeeder` composes presets |
| D3 | Exact preset matrix | Defined above (5 roles × all modules) |
| D4 | `LogsActivity` gaps | Add to `SubscriptionFreeze`; curate `User`/`Setting`/`SaleItem` via Action-level logging |
| D5 | Export authz | Per-resource `export.*` permission mirroring view-holders |
| D6 | Sync/queued export | Threshold 5 000 rows; queued → signed temp URL; `Queue::fake()` in tests |
| D7 | Exporter shape | maatwebsite `FromQuery` per-resource class + dompdf for PDF |
| D8 | Settings keys/validation | Curated key→JSON keys with per-key rules; reuse `StoreSetting` |
| D9 | Audit filters | query-builder: subject alias, causer, date-range; eager-load; `-created_at` |
| D10 | Ungated sweep | Executable route-middleware sweep test (SC-001) |
| D11 | CORS/throttle | Publish `config/cors.php` locked to `FRONTEND_URL`; throttle login/POS/export |
| D12 | US5 RTL/responsive | Frontend out of scope; backend ships QA checklist + state-enabling contract |
