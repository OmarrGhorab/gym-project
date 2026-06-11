# Implementation Plan: POS, Products & Inventory

**Branch**: `003-pos-products-inventory` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Phase 2 from `phases/Phase-2-POS-Products-Inventory.md`, building on Phase 0 (auth/permissions/storage/broadcasting) and Phase 1 (polymorphic payments, members).

## Summary

Build the gym's retail layer on top of the established foundation: **Products** (CRUD, images, stock management, low-stock flagging), a **POS checkout** (cart → sale + items + stock decrement + payment + receipt + realtime broadcast), **inventory movements** (in/out/adjust with full audit trail), **sale voiding** (atomic restock + payment reversal), and **sales reporting** (daily, date-range, by product, by cashier). Two dashboard widgets round out the phase.

The work uses Laravel-native features throughout: Eloquent, Form Requests, Policies, API Resources, dompdf (already installed), broadcasting (Phase 0), and the existing polymorphic `payments` contract from Phase 1. No new packages. `sold_by_user_id` on `sales` references `users` (not `employees`), preserving the cross-phase contract for Phase 3 commissions.

## Technical Context

**Language/Version**: PHP 8.4+, Laravel 12. Run tooling with `~/.config/herd-lite/bin/php` (the PATH `php` is 8.2 and fails the platform check).

**Primary Dependencies** (all already installed — no additions):
- `laravel/sanctum` — auth
- `spatie/laravel-permission` — RBAC
- `spatie/laravel-activitylog` — audit (`LogsActivity` on Product, Sale, InventoryMovement)
- `spatie/laravel-query-builder` — list filtering/sorting
- `barryvdh/laravel-dompdf` — receipt PDF generation (installed Phase 0, first use here)
- `pestphp/pest` + laravel plugin — test-first

**Storage**: MySQL (production); SQLite in-memory (tests). Four new tables: `products`, `sales`, `sale_items`, `inventory_movements`. Reuses `payments` (Phase 1), `members` (Phase 1), `users`, `settings`.

**Testing**: Pest only. SQLite in-memory, `sync` queue, `array` cache/session. Test-first: failing test → implement → green.

**Target Platform**: Backend REST API only, `/api/v1`.

**Performance Goals**: No N+1; indexes on all queried/FK columns; collections paginated; receipt generation on-demand (not queued); realtime broadcast dispatched after transaction commit; report queries use JOINs + aggregates (no PHP-side aggregation of large sets).

**Constraints**: Monetary values stored as `decimal(10,2)` and computed with `bcmath`. Concurrent stock decrement uses `lockForUpdate()` inside `DB::transaction` (same pattern as Phase 1 `RecordPayment`). Sale idempotency key prevents double-submit. Receipt generation failure must not roll back the sale transaction.

**Scale/Scope**: 4 new tables, ~16 endpoints across 5 user stories, 4 Actions (`CreateSaleAction`, `VoidSaleAction`, `AdjustStockAction`, receipt generation), 1 broadcast event.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — PASS.*

| Principle | How this plan complies |
|-----------|------------------------|
| **I. Laravel-First** | Eloquent, Form Requests, Policies, API Resources, dompdf (already installed), broadcasting (Phase 0). No new package. `LogsActivity` trait (Spatie, already installed). |
| **II. Thin Transport** | Controllers: validate (Form Request) → authorize (Policy) → call Action → return Resource. `CreateSaleAction` and `VoidSaleAction` take typed inputs, never the Request. |
| **III. Test-First Pest** | Every endpoint gets feature tests (happy/422/401/403/404); stock-lock concurrency, idempotency, void atomicity, report accuracy get unit tests. Written first. |
| **IV. Versioned Contract** | All routes under `/api/v1`. Reuses Phase 0/1 `{ data, meta, message }` envelope and error shape. Consistent pagination meta. |
| **V. Security by Default** | Explicit `$fillable` on all models; every endpoint `auth:sanctum` + specific permission; `sold_by_user_id` derived server-side never from input; write endpoints rate-limited; image uploads validated (mime/size); `lockForUpdate` on stock decrement; idempotency key unique index. |
| **VI. Performance** | Eager-load relations in Resources; composite indexes `(status, created_at)` on `sales` and `(sale_id, product_id)` on `sale_items`; all list endpoints paginated; report queries use JOINs + `groupBy`/`selectRaw`; broadcast dispatched post-transaction. |
| **VII. YAGNI** | No repository pattern; Actions over ceremony; no speculative abstraction; frontend out of scope; partial-refund deferred to Phase 4. |

**Gate Result**: **PASS**. No violations.

## Cross-Phase Contract Preservation

1. **`sold_by_user_id`** on `sales` → `users` (ON DELETE RESTRICT). Phase 3 links commissions via `employees.user_id`. No forward dependency.
2. **`payments`** reused from Phase 1 (no schema change). New rows: `payable_type = App\Models\Sale`. `payment_method` enum `cash|card|bank_transfer` consistent with Phase 1.
3. **`inventory_movements`** exposed for future Phase 4 cost/stock reporting.
4. **Receipt VAT/currency hooks** read from `settings` table keys; Phase 4 finalizes the settings UI.

## Project Structure

### Documentation (this feature)

```text
specs/003-pos-products-inventory/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions & rationale
├── data-model.md        # Phase 1 — entities, columns, indexes, state transitions
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/
│   └── api.md           # Phase 1 — endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output — created by /speckit-tasks (NOT here)
```

### Source Code (additions only)

```text
app/
├── Actions/
│   ├── Products/           # StoreProduct, UpdateProduct, ToggleProduct, AdjustStock
│   ├── Sales/              # CreateSale, VoidSale, GenerateReceipt
│   └── Reports/            # DailySalesReport, PeriodSalesReport
├── Broadcasting/Events/    # NewSaleEvent
├── Http/
│   ├── Controllers/Api/V1/ # ProductController, SaleController
│   ├── Requests/           # Products/, Sales/ Form Requests
│   └── Resources/          # ProductResource, SaleResource, SaleItemResource,
│                           #   InventoryMovementResource
├── Models/                 # Product, Sale, SaleItem, InventoryMovement
└── Policies/               # ProductPolicy, SalePolicy

database/
├── factories/              # Product, Sale, SaleItem, InventoryMovement factories
├── migrations/             # 4 new tables
└── seeders/                # PosAccessSeeder

routes/
└── api/
    ├── products.php        # Product CRUD + toggle + stock + image
    ├── sales.php           # Sales CRUD + void + receipt + daily + report
    └── dashboard.php       # Extend Phase 1 file: add sales-today, top-products

tests/
├── Feature/Api/V1/
│   ├── Products/           # ProductStoreTest, ProductToggleTest, ProductStockTest
│   └── Sales/              # SaleStoreTest, SaleVoidTest, SaleReceiptTest,
│                           #   SaleReportTest, DailySalesTest, DashboardSalesTest
└── Unit/Actions/Sales/     # CreateSaleTest, VoidSaleTest
```

**Structure Decision**: Single Laravel project, extending Phase 0/1 layout. New `Actions/Products/`, `Actions/Sales/`, `Actions/Reports/` namespaces mirror `Actions/Members/`, `Actions/Subscriptions/` from Phase 1. Permission constants in a new `PosPermissions` class parallel to `MembershipPermissions`.

## Implementation Phasing (maps to spec user stories)

1. **Foundational**: `PosPermissions` constants, `PosAccessSeeder`, 4 migrations, factories.
2. **US1 Products** (P1 blocker): model/migration/factory/policy/requests/resource/controller + image streaming + `AdjustStockAction` + `InventoryMovementResource` + low-stock computed property.
3. **US2 POS Checkout** (P1 core): `CreateSaleAction` (lock → validate stock → compute totals → decrement → write movements → create payment → broadcast `NewSaleEvent`) + `SaleController@store` + `SaleResource` with items.
4. **US3 Void** (P2): `VoidSaleAction` (lock sale → restock each item → reverse payment → write reversal movements) + `SaleController@void`.
5. **US4 Receipt** (P2): `GenerateReceipt` using dompdf + HTML fallback + settings-driven VAT/currency from `settings` table.
6. **US4 Reports** (P2): `DailySalesReport` + `PeriodSalesReport` + `SaleController@daily`/`@report`.
7. **US5 Dashboard widgets** (P3): `sales-today` + `top-products` (extend Phase 1 `DashboardController`).
8. **Polish**: docs sync, Pint, full suite green, review gates.

## Review Gates (mandatory workflow — CLAUDE.md)

1. Analyze requirements against Phase 2 doc + Constitution. ✅ (this plan)
2. `laravel-architecture-reviewer` **before** writing code.
3. `laravel-feature-engineer` — test-first implementation.
4. Full Pest suite green.
5. `laravel-security-reviewer`.
6. `laravel-performance-reviewer`.
7. `laravel-code-reviewer` + `release-readiness-auditor` (final gate).

## Out of Scope

- All frontend: `/products`, `/pos`, `/sales` pages, POS cart UI, receipt print component, dashboard widget UI.
- Partial refunds and per-item voiding (Phase 4 if needed).
- Commission computation on sales (Phase 3 reads `sold_by_user_id`).
- Full multi-format export with branding (Phase 4); basic CSV within this phase is acceptable.
- Offline POS client queue (Phase 4 / frontend concern).
- Payroll and financial roll-up (Phase 3).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | N/A | N/A |
