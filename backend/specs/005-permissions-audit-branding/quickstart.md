# Quickstart & Validation Guide — Phase 4 (Permissions, Audit, Export, Branding)

Runnable validation for the Phase 4 deliverables. Assumes Phases 0–3 are installed (they are) and the app boots.

## Prerequisites

```bash
composer install
php artisan migrate:fresh --seed     # runs DatabaseSeeder incl. new RoleMatrixSeeder
php artisan test                     # full Pest suite must be green
```

- DB: MySQL in dev; tests use SQLite in-memory (`phpunit.xml`), `sync` queue, `array` cache.
- Confirm `config/cors.php` exists and `allowed_origins` resolves from `FRONTEND_URL` (set it in `.env`).

## Validation scenarios

Each maps to a spec user story. Run via Pest (`php artisan test --filter=...`) or manually with a token from `POST /api/v1/auth/login`.

### US1 — Permission matrix & roles (P1)
1. **Catalog**: `GET /api/v1/permissions` as Admin → 200 with every module's permissions, grouped; as Cashier → 403.
2. **Presets** (SC-003): after `--seed`, assert each of Admin/Manager/Cashier/Captain/Accountant holds exactly the [D3 matrix](./research.md#d3--final-preset--permission-matrix-the-authoritative-composition) permission set.
3. **Custom role** (SC-002): `POST /api/v1/roles {name:"Front Desk", permissions:["members.view","members.create"]}` → 201; assign to a user via `POST /api/v1/users/{id}/roles`; that user can `GET /members` (200) but `GET /sales` (403) — without re-login (FR-006).
4. **Lock-out guard** (FR-008): attempt to delete/edit the last role granting `roles.manage` → 422.
5. **Gating sweep** (SC-001): `php artisan test --filter=EndpointGatingSweepTest` → green (every non-public `/api/v1` route has `auth:sanctum` + a `permission:` gate).
- **Contracts**: [contracts/api.md → Permissions & Roles](./contracts/api.md#permissions--roles).

### US2 — Audit log (P1)
1. Perform actions (create a member, change a role, record a payment).
2. `GET /api/v1/audit-logs` as Admin → 200, newest-first, paginated; entries show causer + subject + action + time (SC-004).
3. Filter: `filter[causer]={userId}&filter[from]=2026-06-01&filter[to]=2026-06-11` narrows correctly (SC-005); `filter[subject]=member` returns only member entries.
4. `from > to` → 422. As a user without `audit.view` → 403.
- **Contracts**: [contracts/api.md → Audit Log](./contracts/api.md#audit-log).

### US3 — Export (P2)
1. **Formats** (SC-006): `GET /api/v1/export/members?format=xlsx|csv|pdf` as Admin → file download; contents match the filtered list (apply a `filter[...]` and confirm rows match).
2. **Queued large** (SC-007): seed > threshold rows; request export → 202 with `export_id`; assert `GenerateExportJob` dispatched (`Queue::fake()` in tests); completed file retrievable via signed URL.
3. **Permission** (SC-008): a user lacking `export.payroll` → `GET /export/payroll` → 403, no file.
4. **Validation**: unknown resource or `format=foo` → 422.
- **Contracts**: [contracts/api.md → Export](./contracts/api.md#export). Design: [research.md D6/D7](./research.md#d6--sync-vs-queued-export-threshold-and-retrieval).

### US4 — Settings & branding (P2)
1. `GET /api/v1/settings` as Admin → current name/colors/logo/reminder_days/currency/vat_rate/receipt_template.
2. `PUT /api/v1/settings {reminder_days:7, vat_rate:15, gym:{name:"ATP Gym", colors:{primary:"#0A0A0A"}}}` → 200; read back persists (SC-009).
3. **Validation**: `reminder_days:-1` or `vat_rate:120` → 422.
4. **Downstream** (SC-009): updated `reminder_days` is picked up by `FindExpiringSubscriptions`; `vat_rate`/`receipt_template` by P2 receipts — asserted in `SettingsDownstreamTest`.
5. As non-Admin → 403; change writes an audit entry.
- **Contracts**: [contracts/api.md → Settings](./contracts/api.md#settings).

### US5 — Responsive/RTL QA (P3, frontend)
Backend-only repo: see the **manual QA checklist** below; the backend's role is to make these achievable (consistent envelope, correct status codes, paginated/empty-safe lists). See [research.md D12](./research.md#d12--responsivertl-qa-us5-handling-in-a-backend-only-deliverable).

**Manual QA checklist (dashboard team):**
- [ ] Every page renders without overflow/overlap on desktop and reflows usably on mobile (no horizontal scroll).
- [ ] RTL (Arabic): text direction, alignment, component mirroring correct on every page.
- [ ] Lists/reports with no data show a clear empty state (backend returns 200 + empty `data`).
- [ ] Loading and error states render (backend returns correct 4xx/5xx with stable error shape).
- [ ] ATP branding (name/colors/logo) pulled from `GET /settings` is applied.

## Final gates (Definition of Done)
- [ ] Full Pest suite green (`php artisan test`), incl. gating sweep + export + permissions (SC-011).
- [ ] `vendor/bin/pint` clean.
- [ ] Security review: gating sweep passes, CORS locked, export links signed, `$hidden` verified.
- [ ] Performance review: audit viewer no N+1, indexes verified, large export queued.
- [ ] `release-readiness-auditor` PASS.
