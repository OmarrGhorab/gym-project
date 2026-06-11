# Tasks: POS, Products & Inventory (Phase 2)

**Input**: Design documents from `/specs/003-pos-products-inventory/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: Required by the Constitution (Test-First with Pest). Write the failing Pest test first, watch it fail, then implement to green.

**Organization**: Grouped by user story so each can be implemented and validated independently after the shared foundation. Run tooling with `~/.config/herd-lite/bin/php`.

**Conventions**: Explicit `$fillable`; authorization in Policies; validation in Form Requests; logic in Actions (typed args, never the Request); responses via API Resources; all routes under `/api/v1`; eager-load to avoid N+1; index every FK/queried column; money as `decimal(10,2)` computed with `bcmath`; stock decrement via `lockForUpdate()` in `DB::transaction`; `sold_by_user_id` → `users` (never `employees`).

---

## Phase 1: Setup (Shared Dependencies)

**Purpose**: No new packages required — all dependencies (dompdf, Spatie, Pest) installed in Phase 0. Verify, prepare per-area route files, and run the architecture review.

- [x] T001 Verify Phase 0 packages still present (`barryvdh/laravel-dompdf`, `spatie/laravel-activitylog`, `spatie/laravel-query-builder`, `pestphp/pest`) via `composer show`; confirm nothing to install.
- [x] T002 Run and record the pre-implementation architecture review (`laravel-architecture-reviewer`) in `specs/003-pos-products-inventory/reviews/architecture.md`. Block on any BLOCKER findings before Phase 2.
- [x] T003 Create per-area route files `routes/api/products.php` and `routes/api/sales.php`; extend existing `routes/api/dashboard.php` for Phase 2 widgets; register all three in the `/api/v1` group in `routes/api.php`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every story depends on. No story work begins until this phase is complete.

**⚠️ CRITICAL**: All four migrations, the seeder, the permission constants, the `NewSaleEvent` broadcast skeleton, and model relations on `User`/`Member` must exist before any story phase begins.

- [x] T004 Create `app/Support/PosPermissions.php` with permission constants (`products.view`, `products.create`, `products.update`, `products.delete`, `sales.view`, `sales.create`, `sales.void`, `inventory.adjust`, `reports.view`), mirroring `app/Support/MembershipPermissions.php`.
- [x] T005 Create `database/seeders/PosAccessSeeder.php` registering all Phase 2 permissions (idempotent `firstOrCreate`) and assigning to roles: admin (all), manager (all), cashier (`products.view`, `sales.view`, `sales.create`), accountant (`sales.view`, `reports.view`).
- [x] T006 Wire `PosAccessSeeder` into `database/seeders/DatabaseSeeder.php` after `MembershipAccessSeeder`.
- [x] T007 [P] Create migration `database/migrations/*_create_products_table.php` per data-model (all columns, indexes on `sku` UNIQUE, `is_active`, `category`).
- [x] T008 [P] Create migration `database/migrations/*_create_sales_table.php` per data-model (all columns, FKs to `members`+`users`, UNIQUE index on `idempotency_key`, composite index `(status, created_at)`, index on `sold_by_user_id`, `member_id`).
- [x] T009 [P] Create migration `database/migrations/*_create_sale_items_table.php` per data-model (FKs to `sales` cascade + `products` restrict, composite index `(sale_id, product_id)`).
- [x] T010 [P] Create migration `database/migrations/*_create_inventory_movements_table.php` per data-model (FK `product_id` restrict, FK `created_by` set null, indexes on `product_id`, `created_by`, `created_at`).
- [x] T011 Run `php artisan migrate` to apply all four new migrations.
- [x] T012 Add `salesSold()` (hasMany Sale via `sold_by_user_id`) relation to `app/Models/User.php` without altering `$fillable`/`$hidden`.
- [x] T013 Add `sales()` (hasMany Sale via `member_id`) relation to `app/Models/Member.php` without altering existing model definition.
- [x] T014 Create skeleton broadcast event `app/Broadcasting/Events/NewSaleEvent.php` (implements `ShouldBroadcast`, broadcasts on `dashboard` private channel, payload: sale id, total, cashier name, timestamp). Full dispatch wired in US2.

**Checkpoint**: All four tables migrated, permissions seeded, role assignments ready, User/Member relations added, broadcast event skeleton in place. User story phases can now proceed.

---

## Phase 3: User Story 1 - Product Catalog Management (Priority: P1) 🎯 MVP

**Goal**: Authorized managers can create, read, update, and toggle products, upload product images, and adjust stock with full inventory movement audit trail. Low-stock flag surfaces automatically.

**Independent Test**: Create a product with image → list with `is_active` and `is_low_stock` filters → update price → adjust stock down below threshold → confirm `is_low_stock=true` → toggle inactive → confirm absent from `?is_active=true` results. Assert 401/403/422/404 paths on all endpoints.

### Tests for US1

- [ ] T015 [P] [US1] Failing feature tests for `GET /products` (list, filters `is_active`/`is_low_stock`/`category`/`search`, pagination, 200/401/403) in `tests/Feature/Api/V1/Products/ProductIndexTest.php`.
- [ ] T016 [P] [US1] Failing feature tests for `POST /products` (201, 422 duplicate SKU/invalid fields, 403) in `tests/Feature/Api/V1/Products/ProductStoreTest.php`.
- [ ] T017 [P] [US1] Failing feature tests for `PUT /products/{id}` and `PATCH /products/{id}/toggle` (200, 404, 422, 403) in `tests/Feature/Api/V1/Products/ProductUpdateTest.php`.
- [ ] T018 [P] [US1] Failing feature tests for `POST /products/{id}/stock` (201, 422 over-deduct, 403 without `inventory.adjust`) and `GET /products/{id}/image` (200 stream, 403, 404) in `tests/Feature/Api/V1/Products/ProductStockTest.php`.

### Implementation for US1

- [ ] T019 [US1] Create `app/Models/Product.php` (explicit `$fillable`, decimal casts, `LogsActivity`, `active()` and `lowStock()` scopes, `is_low_stock` computed accessor, relations: `saleItems`, `inventoryMovements`).
- [ ] T020 [P] [US1] Create `database/factories/ProductFactory.php` (realistic gym product data: name, sku, price, cost, stock, threshold, category).
- [ ] T021 [P] [US1] Create `app/Policies/ProductPolicy.php` (viewAny/view/create/update/delete mapped to `products.*`; image stream uses `view`).
- [ ] T022 [P] [US1] Create `app/Http/Requests/Products/StoreProductRequest.php` (authorize via `ProductPolicy@create`; rules: name, category, sku unique, price gt:0, cost gte:0, stock gte:0, threshold gte:0, image mimes/size optional).
- [ ] T023 [P] [US1] Create `app/Http/Requests/Products/UpdateProductRequest.php` (authorize via `ProductPolicy@update`; same rules, sku unique excluding current).
- [ ] T024 [P] [US1] Create `app/Http/Resources/ProductResource.php` (envelope-compatible; includes `is_low_stock` computed boolean, `image_url` pointing to `/api/v1/products/{id}/image`; `whenLoaded` guards on relations).
- [ ] T025 [P] [US1] Create `app/Models/InventoryMovement.php` (explicit `$fillable`, `LogsActivity`, relations: `product`, `createdBy`).
- [ ] T026 [P] [US1] Create `app/Http/Resources/InventoryMovementResource.php`.
- [ ] T027 [P] [US1] Create `database/factories/InventoryMovementFactory.php`.
- [ ] T028 [US1] Create Actions in `app/Actions/Products/`: `StoreProduct` (handle image upload to local disk, persist path), `UpdateProduct` (replace image if provided), `ToggleProduct`, `AdjustStock` (validate `type=out` does not exceed current stock, decrement/increment `stock_quantity`, write `InventoryMovement` row, all in `DB::transaction`).
- [ ] T029 [US1] Create `app/Http/Controllers/Api/V1/ProductController.php` (index with Spatie Query Builder filters/sorts, store, show, update, toggle, stock-adjust, image-stream via Policy-gated `Storage::disk('local')->get`).
- [ ] T030 [US1] Register product routes in `routes/api/products.php` under `auth:sanctum`; write routes throttled.
- [ ] T031 [US1] Run focused US1 tests — all green.

**Checkpoint**: Product catalog fully functional and independently testable. Managers can maintain the full catalog with images and stock control.

---

## Phase 4: User Story 2 - POS Checkout & Sale Creation (Priority: P1)

**Goal**: Authorized cashiers ring up multi-item sales with optional discounts, optional member links, and payment method selection. Checkout atomically decrements stock, writes inventory movements, creates a payment record, and broadcasts a real-time new-sale event.

**Independent Test**: Ring up a 2-item sale with discount → verify sale created with correct totals, stock decremented per item, InventoryMovement rows written, Payment row created with `payable_type=App\Models\Sale` → resubmit same `idempotency_key` → verify same sale returned (no duplicate) → attempt sale with quantity > stock → verify 422 `insufficient_stock`.

### Tests for US2

- [ ] T032 [P] [US2] Failing feature tests for `POST /sales` happy path (201, correct totals, stock decremented, payment created, idempotency, member-linked variant, 401/403) in `tests/Feature/Api/V1/Sales/SaleStoreTest.php`.
- [ ] T033 [P] [US2] Failing feature tests for `POST /sales` failure paths (422 insufficient stock per item, inactive product, inactive member, negative total after discount, invalid payment method) in `tests/Feature/Api/V1/Sales/SaleStoreValidationTest.php`.
- [ ] T034 [P] [US2] Failing feature tests for `GET /sales` (list, filters, pagination, 200/401/403) and `GET /sales/{id}` (200, 404, 403) in `tests/Feature/Api/V1/Sales/SaleIndexTest.php`.
- [ ] T035 [P] [US2] Failing unit tests for `CreateSaleAction`: totals computation, discount guard (total must be > 0), stock lock, idempotency return, concurrent stock decrement, payment creation, broadcast dispatch in `tests/Unit/Actions/Sales/CreateSaleTest.php`.

### Implementation for US2

- [ ] T036 [US2] Create `app/Models/Sale.php` (explicit `$fillable`, decimal casts, `LogsActivity`, `completed()` and `voided()` scopes, relations: `items`, `payment` morphOne, `member`, `soldBy`, `inventoryMovements` through sale items).
- [ ] T037 [P] [US2] Create `app/Models/SaleItem.php` (explicit `$fillable`, decimal casts, relations: `sale`, `product`).
- [ ] T038 [P] [US2] Create `database/factories/SaleFactory.php` and `database/factories/SaleItemFactory.php`.
- [ ] T039 [P] [US2] Create `app/Policies/SalePolicy.php` (viewAny/view mapped to `sales.view`; create to `sales.create`; void to `sales.void`).
- [ ] T040 [P] [US2] Create `app/Http/Requests/Sales/StoreSaleRequest.php` (authorize via `SalePolicy@create`; rules: `idempotency_key` uuid required, `member_id` nullable exists active member, `items` array min:1, `items.*.product_id` exists active product, `items.*.quantity` integer gt:0, `discount` nullable decimal gte:0, `payment_method` in:cash,card,bank_transfer, `notes` nullable max:500).
- [ ] T041 [P] [US2] Create `app/Http/Resources/SaleResource.php` (full resource with eager-loaded items via `SaleItemResource`, payment, member summary, cashier summary; `whenLoaded` guards).
- [ ] T042 [P] [US2] Create `app/Http/Resources/SaleItemResource.php` (sale item with product name snapshot).
- [ ] T043 [US2] Create `app/Actions/Sales/CreateSaleAction.php`: wrap entirely in `DB::transaction`; re-read each product with `lockForUpdate()`; validate stock per item (throw `ValidationException` with key `items.{n}.quantity` on overflow); compute `subtotal` and `total` with `bcmath`; reject if `discount >= subtotal`; decrement `stock_quantity` per product; write one `InventoryMovement(type=out)` per item; check `idempotency_key` and return existing sale if found; create `Sale` + `SaleItems` + `Payment(payable_type=Sale, status=paid)`; dispatch `NewSaleEvent` **after** the transaction commits (not inside it).
- [ ] T044 [US2] Create `app/Http/Controllers/Api/V1/SaleController.php` (store, index with Spatie Query Builder, show).
- [ ] T045 [US2] Register sale routes (store, index, show) in `routes/api/sales.php` under `auth:sanctum`; `POST /sales` throttled.
- [ ] T046 [US2] Run focused US2 tests — all green.

**Checkpoint**: POS checkout fully operational. Cashiers can ring up sales; stock is always accurate after checkout; duplicates are idempotency-guarded.

---

## Phase 5: User Story 3 - Sale Voiding & Stock Reversal (Priority: P2)

**Goal**: Authorized managers can void a completed sale; the system atomically reverses the payment and restores all decremented stock quantities. Double-void is rejected. Unauthorized void returns 403.

**Independent Test**: Complete a sale → void it with manager token → verify `status=voided`, stock restored per item, payment marked `voided`, reversal `InventoryMovement` rows written → attempt to void again → verify 422 `sale_already_voided` → attempt void with cashier token → verify 403.

### Tests for US3

- [ ] T047 [P] [US3] Failing feature tests for `POST /sales/{id}/void` (200 happy, 422 already-voided, 403 without `sales.void`, 404) in `tests/Feature/Api/V1/Sales/SaleVoidTest.php`.
- [ ] T048 [P] [US3] Failing unit tests for `VoidSaleAction`: atomicity (partial failure rolls back), stock restoration per item, payment status update, reversal inventory movements, double-void guard in `tests/Unit/Actions/Sales/VoidSaleTest.php`.

### Implementation for US3

- [ ] T049 [US3] Create `app/Actions/Sales/VoidSaleAction.php`: wrap in `DB::transaction`; re-read sale with `lockForUpdate()`; guard `status=voided` (throw 422 `sale_already_voided`); for each sale item, re-read product with `lockForUpdate()`, increment `stock_quantity`, write `InventoryMovement(type=in, reason="void #{sale_id}")`; update payment `status=voided`; set `sale.status=voided`.
- [ ] T050 [P] [US3] Create `app/Http/Requests/Sales/VoidSaleRequest.php` (authorize via `SalePolicy@void`; optional `reason` string max:255).
- [ ] T051 [US3] Add `void` method to `app/Http/Controllers/Api/V1/SaleController.php`.
- [ ] T052 [US3] Register `POST /sales/{id}/void` route in `routes/api/sales.php` under `auth:sanctum`; throttled.
- [ ] T053 [US3] Run focused US3 tests — all green.

**Checkpoint**: Void flow complete. Managers can correct POS errors with full stock and payment integrity.

---

## Phase 6: User Story 4 - Receipt Generation & Sales Reporting (Priority: P2)

**Goal**: Cashiers and managers can retrieve formatted receipts for any completed sale. Managers can view daily totals and periodic reports filtered by date range, product, and cashier — all reconciling with payment records.

**Independent Test (Receipt)**: Request PDF receipt for a known sale → verify 200 `application/pdf` stream → request HTML receipt → verify 200 HTML with correct line items, totals, and payment method.

**Independent Test (Reports)**: Seed known sales across two days → request daily report for day 1 → verify total matches sum of day-1 payments → request periodic report filtered by product → verify per-product revenue matches → request with cashier filter → verify only that cashier's sales.

### Tests for US4

- [ ] T054 [P] [US4] Failing feature tests for `GET /sales/{id}/receipt` (200 PDF stream, 200 HTML view, 404, 403) in `tests/Feature/Api/V1/Sales/SaleReceiptTest.php`.
- [ ] T055 [P] [US4] Failing feature tests for `GET /sales/daily` (200 correct total and list, 422 invalid date, 403) in `tests/Feature/Api/V1/Sales/DailySalesTest.php`.
- [ ] T056 [P] [US4] Failing feature tests for `GET /sales/report` (200 grouped by product, by cashier, by day; totals reconcile with payments; 422 missing date / `from > to` / range > 366 days; 403) in `tests/Feature/Api/V1/Sales/SaleReportTest.php`.

### Implementation for US4

- [ ] T057 [US4] Create receipt Blade view `resources/views/receipts/sale.blade.php` (line items table, discount, total, payment method, cashier, member name if linked, date, VAT rate from `settings('vat_rate', 0)`, currency symbol from `settings('currency_symbol', 'LE')`).
- [ ] T058 [US4] Create `app/Actions/Sales/GenerateReceipt.php`: load sale with eager-loaded items and product names; render Blade view; if `Accept: application/pdf` use dompdf to stream PDF; otherwise return HTML view. Receipt generation failure must NOT roll back or affect the sale — wrap in try/catch and surface a 500 on failure.
- [ ] T059 [US4] Create `app/Actions/Reports/DailySalesReport.php`: query `sales` where `status=completed` and `date(created_at) = $date`; JOIN `payments` to derive total; return list + aggregate.
- [ ] T060 [US4] Create `app/Actions/Reports/PeriodSalesReport.php`: accept `from`, `to`, optional `product_id`, `cashier_id`, `group_by`; build JOIN query with `groupBy`/`selectRaw` aggregate (SUM revenue, COUNT sales, SUM units per group); use `cursorPaginate(50)` for grouped results; validate max range 366 days.
- [ ] T061 [US4] Add `receipt`, `daily`, and `report` methods to `app/Http/Controllers/Api/V1/SaleController.php`.
- [ ] T062 [P] [US4] Create `app/Http/Requests/Sales/DailySalesRequest.php` (authorize `reports.view`; optional `date` validated as date).
- [ ] T063 [P] [US4] Create `app/Http/Requests/Sales/PeriodSalesRequest.php` (authorize `reports.view`; required `from`/`to` dates; `from <= to`; max range 366 days; optional `product_id`, `cashier_id`, `group_by` in:product,cashier,day).
- [ ] T064 [US4] Register `GET /sales/{id}/receipt`, `GET /sales/daily`, `GET /sales/report` in `routes/api/sales.php`.
- [ ] T065 [US4] Run focused US4 tests — all green.

**Checkpoint**: Receipts available for every completed sale; daily and periodic reports accurate and reconciled with payments.

---

## Phase 7: User Story 5 - Dashboard Sales Widgets (Priority: P3)

**Goal**: Managers see today's sales total and top-selling products on the dashboard, refreshing live after each new sale.

**Independent Test**: Seed sales for today and past days → request `GET /dashboard/sales-today` → verify only today's revenue and count → request `GET /dashboard/top-products?limit=5&period=week` → verify top 5 products ranked by revenue, none from outside the week.

### Tests for US5

- [ ] T066 [P] [US5] Failing feature tests for `GET /dashboard/sales-today` (200 correct values, updates after new sale, 403) in `tests/Feature/Api/V1/Dashboard/DashboardSalesTest.php`.
- [ ] T067 [P] [US5] Failing feature tests for `GET /dashboard/top-products` (200 correct ranking for today/week/month, limit respected, 422 invalid period/limit, 403) in `tests/Feature/Api/V1/Dashboard/DashboardTopProductsTest.php`.

### Implementation for US5

- [ ] T068 [P] [US5] Create `app/Http/Requests/Dashboard/TopProductsRequest.php` (authorize `reports.view`; `limit` integer 1–20 default 5; `period` in:today,week,month default:week).
- [ ] T069 [US5] Add `salesToday()` and `topProducts()` methods to `app/Http/Controllers/Api/V1/DashboardController.php` (extend Phase 1 controller; `salesToday` uses `DB::table('sales')->whereDate('created_at', today())->where('status','completed')`; `topProducts` JOINs `sale_items` on `sales` for the period, groups by `product_id`, orders by SUM revenue DESC, limits to `$request->limit`).
- [ ] T070 [US5] Register `GET /dashboard/sales-today` and `GET /dashboard/top-products` in `routes/api/dashboard.php` under `auth:sanctum`.
- [ ] T071 [US5] Run focused US5 tests — all green.

**Checkpoint**: Dashboard widgets live; managers have at-a-glance revenue and product insights.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration, documentation sync, final review gates, and full suite validation.

- [ ] T072 [P] Sync `specs/003-pos-products-inventory/contracts/api.md` against the final implemented routes, request rules, and response shapes — update any drifted contract details.
- [ ] T073 [P] Complete `specs/003-pos-products-inventory/quickstart.md` validation — run all 8 scenarios manually or via the test suite and confirm each expected outcome.
- [ ] T074 [P] Run `vendor/bin/pint` and commit formatting fixes; zero violations before merge.
- [ ] T075 Run full Pest suite (`~/.config/herd-lite/bin/php artisan test`); all green.
- [ ] T076 Run `laravel-security-reviewer` agent; record findings in `specs/003-pos-products-inventory/reviews/security.md`; resolve all blockers.
- [ ] T077 Run `laravel-performance-reviewer` agent; record in `specs/003-pos-products-inventory/reviews/performance.md`; resolve all blockers.
- [ ] T078 Run `laravel-code-reviewer` agent; record in `specs/003-pos-products-inventory/reviews/code-review.md`; resolve all blockers.
- [ ] T079 Run `release-readiness-auditor`; record in `specs/003-pos-products-inventory/reviews/release-readiness.md`; PASS gate before merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** — No dependencies. Start immediately.
- **Foundational (Phase 2)** — Depends on Phase 1 completion. **BLOCKS all user stories.**
- **US1 Products (Phase 3)** — Depends on Foundational only. No dependency on US2–US5.
- **US2 POS Checkout (Phase 4)** — Depends on Foundational + US1 (products must exist as entities). US2 uses the `Product` model and policy; US1 must be code-complete before US2 implementation begins.
- **US3 Void (Phase 5)** — Depends on US2 (`Sale` model, `SaleItem`, `Payment` wiring).
- **US4 Receipt + Reports (Phase 6)** — Depends on US2 (needs real sale data and the `Sale` model).
- **US5 Dashboard Widgets (Phase 7)** — Depends on US2 (reads `sales` table).
- **Polish (Phase 8)** — Depends on all desired stories complete.

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1 Products)
                                          → Phase 3 done → Phase 4 (US2 Checkout)
                                                         → Phase 4 done → Phase 5 (US3 Void)
                                                         → Phase 4 done → Phase 6 (US4 Reports)
                                                         → Phase 4 done → Phase 7 (US5 Widgets)
```

US3, US4, and US5 all depend on US2 but are independent of each other — they can proceed in parallel once Phase 4 is done.

### Within Each User Story

1. Write failing tests first (all `[P]` test tasks can be written in parallel)
2. Models and factories (`[P]` within a story) before Actions
3. Policies and Requests (`[P]` within a story) before Controllers
4. Actions before Controllers
5. Controllers before Route registration
6. Run story tests to green before closing the phase

### Parallel Opportunities

- All `[P]`-marked tasks within a phase can run in parallel
- Phase 2 tasks T007–T010 (all four migrations) can be written in parallel
- US1 tests T015–T018 can all be written in parallel before any implementation
- US2 tests T032–T035 can all be written in parallel
- Models, Policies, Requests, and Resources within a story are all `[P]` — write them concurrently
- Once Phase 4 is done: US3, US4, and US5 can be developed in parallel by different agents/developers

---

## Parallel Example: User Story 2 (POS Checkout)

```bash
# Write all US2 tests in parallel (before any implementation):
Task T032: Failing feature tests POST /sales happy path
Task T033: Failing feature tests POST /sales failure paths
Task T034: Failing feature tests GET /sales index/show
Task T035: Failing unit tests CreateSaleAction

# Then write these in parallel (no inter-dependencies):
Task T036: Sale model              Task T037: SaleItem model + factory
Task T038: SaleFactory             Task T039: SalePolicy
Task T040: StoreSaleRequest        Task T041: SaleResource
Task T042: SaleItemResource

# Then sequentially (each depends on the above):
Task T043: CreateSaleAction (depends on T036, T037, T039, T040)
Task T044: SaleController@store (depends on T043, T041)
Task T045: Route registration
Task T046: Run tests to green
```

---

## Implementation Strategy

### MVP First (US1 + US2 = working POS)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (4 migrations, seeder, models wired)
3. Complete Phase 3: US1 Products (catalog, images, stock adjust)
4. Complete Phase 4: US2 POS Checkout
5. **STOP and VALIDATE**: Products + Checkout = fully working POS MVP. Demo-able.

### Incremental Delivery

- MVP (US1 + US2): Products catalog + POS checkout → cashiers can ring up sales
- +US3 Void: Error correction capability → manager can undo sales
- +US4 Reports + Receipts: Financial visibility + receipt printing
- +US5 Widgets: Live dashboard revenue stats
- Polish: Reviews, docs, full suite, release gate

### Parallel Strategy (if multiple agents/developers)

After Phase 2 (Foundational) is complete and Phase 3 (US1) is complete:
- Agent A: US2 POS Checkout (Phase 4)
- After US2 completes:
  - Agent B: US3 Void (Phase 5)
  - Agent C: US4 Reports + Receipts (Phase 6)
  - Agent D: US5 Dashboard Widgets (Phase 7)

---

## Notes

- `[P]` tasks = different files, no blocking inter-dependencies within the phase
- `[Story]` label maps each task to a user story for traceability
- `sold_by_user_id` on `Sale` is set server-side from `auth()->id()` — never accepted from request input
- Concurrent stock decrement requires `lockForUpdate()` on product rows inside `DB::transaction` — do not skip this
- Receipt generation failure (dompdf error) must NOT roll back or void the sale; handle as a 500 surfaced to the caller
- `idempotency_key` UNIQUE index enforces dedup at the DB level; application checks for existing sale and returns it (201) if found
- Commit after each task or logical group; do not batch across multiple user stories
- Run `vendor/bin/pint` before each commit — formatting failures block merge
