# Tasks: Employees, Payroll, Commissions & Reports (Phase 3)

**Input**: Design documents from `/specs/004-employees-payroll-reports/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: Required by the Constitution (Test-First with Pest). Write the failing Pest test first, watch it fail, then implement to green.

**Organization**: Grouped by user story so each can be implemented and validated independently after the shared foundation. Run tooling with `~/.config/herd-lite/bin/php`.

**Conventions**: Explicit `$fillable`; authorization in Policies; validation in Form Requests; logic in Actions (typed args, never the Request); responses via API Resources; all routes under `/api/v1`; eager-load to avoid N+1; reports use JOIN + aggregates (no correlated subqueries); index every FK/queried column; money as `decimal(10,2)` computed with `bcmath`; rates as `decimal(5,4)`; `month` as `char(7)` `YYYY-MM`; commission link is `employees.user_id` ⇄ `sold_by_user_id`; revenue reads **paid** `payments` only.

---

## Phase 1: Setup (Shared Dependencies)

**Purpose**: No new packages — all dependencies (Spatie, dompdf, Pest) installed in Phase 0. Verify, prepare route files, run the architecture review.

- [ ] T001 Verify Phase 0–2 packages still present (`spatie/laravel-permission`, `spatie/laravel-activitylog`, `spatie/laravel-query-builder`, `barryvdh/laravel-dompdf`, `pestphp/pest`) via `composer show`; confirm nothing to install.
- [x] T002 Run and record the pre-implementation architecture review (`laravel-architecture-reviewer`) in `specs/004-employees-payroll-reports/reviews/architecture.md`. Block on any BLOCKER findings before Phase 2.
- [ ] T003 Create per-area route files `routes/api/employees.php`, `routes/api/commissions.php`, `routes/api/payroll.php`, `routes/api/expenses.php`, `routes/api/reports.php` (comment-only stubs); register all five plus the existing `routes/api/dashboard.php` in the `auth:sanctum` `/api/v1` group in `routes/api.php`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every story depends on. No story work begins until this phase is complete.

**⚠️ CRITICAL**: All four new-table migrations, the additive index/column migrations, the permission constants + seeder, the shared `Expense` model, and the `User`/`Plan` additive edits must exist before any story phase begins.

- [ ] T004 Create `app/Support/HrFinancePermissions.php` with constants `employees.{view,create,update,delete}`, `commissions.{view,backfill}`, `payroll.{view,generate,pay}`, `expenses.{view,create,update,delete}` and an `ALL_PERMISSIONS` array, mirroring `app/Support/PosPermissions.php`. (Reuse existing `reports.view` from `PosPermissions` — do not redefine it.)
- [ ] T005 Create `database/seeders/HrFinanceAccessSeeder.php` registering all Phase 3 permissions (idempotent `firstOrCreate`) and assigning to roles: admin (all), manager (all), accountant (`reports.view`, `expenses.*`, `payroll.view`, `commissions.view`). Roles created by `FoundationAccessSeeder`.
- [ ] T006 Wire `HrFinanceAccessSeeder` into `database/seeders/DatabaseSeeder.php` after `PosAccessSeeder`.
- [ ] T007 [P] Create migration `database/migrations/*_create_employees_table.php` per data-model (FK `user_id` nullable UNIQUE `nullOnDelete`; `role`, `base_salary` decimal(10,2), `commission_rate` decimal(5,4), `hire_date`, `status`; indexes on `status`, `role`).
- [ ] T008 [P] Create migration `database/migrations/*_create_commissions_table.php` per data-model (FK `employee_id` `restrictOnDelete`; `morphs('source')`; `rate` decimal(5,4), `amount` decimal(10,2), `month` char(7), `status`; UNIQUE `(source_type, source_id)`; composite index `(employee_id, month, status)`).
- [ ] T009 [P] Create migration `database/migrations/*_create_payroll_table.php` per data-model (FK `employee_id` `restrictOnDelete`; `month` char(7), salary/commission/bonus/deduction/net decimals, `status`, `paid_at`; UNIQUE `(employee_id, month)`; index `(month, status)`).
- [ ] T010 [P] Create migration `database/migrations/*_create_expenses_table.php` per data-model (`category`, `amount` decimal(10,2), `description`, `date`, FK `created_by` nullable `nullOnDelete`; indexes on `date`, `category`).
- [ ] T011 [P] Create migration `database/migrations/*_add_commission_rate_to_plans_table.php` adding nullable `commission_rate` decimal(5,4) after `price`; reversible `down()` drops the column.
- [ ] T012 [P] Create migration `database/migrations/*_add_revenue_indexes_to_payments_table.php` adding composite indexes `(status, paid_at)` and `(payable_type, payable_id, status)`; reversible `down()` drops both. (Verified existing `(status, created_at)` + morphs index are not duplicated.)
- [ ] T013 [P] Create migration `database/migrations/*_add_seller_indexes.php` adding `(sold_by_user_id, created_at)` to `sales` and `(sold_by_user_id)` to `subscriptions`; reversible `down()` drops them.
- [ ] T014 Run `php artisan migrate` to apply all seven migrations; confirm clean rollback with `migrate:rollback` on a scratch run.
- [ ] T015 Add `employee()` (`HasOne` Employee via `user_id`) relation to `app/Models/User.php` without altering `$fillable`/`$hidden`.
- [ ] T016 Add `commission_rate` to `app/Models/Plan.php` `$fillable` and cast `decimal:4` — additive only, no behavior change to Phase 1 plan logic.
- [ ] T017 [P] Create `app/Models/Expense.php` (shared by US3 payout, US4 CRUD, US5 reports): explicit `$fillable`, `amount`→`decimal:2`/`date`→`date` casts, `LogsActivity` (`useLogName('expenses')`), `creator()` belongsTo `User`.
- [ ] T018 [P] Create `database/factories/ExpenseFactory.php` (realistic categories: rent, utilities, equipment, payroll).

**Checkpoint**: All tables migrated + reversible, permissions seeded, shared `Expense` model + `User`/`Plan` edits in place. Story phases can now proceed.

---

## Phase 3: User Story 1 - Employee & Captain Management (Priority: P1) 🎯 MVP

**Goal**: Authorized admins maintain the staff roster (employee/captain/manager) with base salary, commission rate, hire date, status, and an optional **unique** link to a `users` account. Employee profile aggregates details.

**Independent Test**: Create a captain with a `user_id` → attempt a second employee with the same `user_id` (422) → list with `role`/`status` filters → update rate (does not alter recorded data) → deactivate → confirm excluded from payroll candidates. Assert 401/403/404 paths.

### Tests for US1

- [ ] T019 [P] [US1] Failing feature tests for `GET /employees` (list, filters `role`/`status`/`q`, cursor pagination, 200/401/403) in `tests/Feature/Api/V1/Employees/EmployeeIndexTest.php`.
- [ ] T020 [P] [US1] Failing feature tests for `POST /employees` (201; 422 invalid role/negative rate; 422 `user_id` already linked / non-existent; 403) in `tests/Feature/Api/V1/Employees/EmployeeStoreTest.php`.
- [ ] T021 [P] [US1] Failing feature tests for `GET/PUT/DELETE /employees/{id}` (200 profile; 200 update; 404; 422/409 delete-with-history restrict; 403) in `tests/Feature/Api/V1/Employees/EmployeeUpdateTest.php`.

### Implementation for US1

- [ ] T022 [US1] Create `app/Models/Employee.php` (explicit `$fillable`, decimal casts for salary/rate, `hire_date` date cast, `LogsActivity`, relations `user`/`commissions`/`payrolls`, `active()` scope).
- [ ] T023 [P] [US1] Create `database/factories/EmployeeFactory.php` (states: `captain` with rate, `manager`, unlinked vs linked-to-user).
- [ ] T024 [P] [US1] Create `app/Policies/EmployeePolicy.php` (viewAny/view/create/update/delete mapped to `employees.*`).
- [ ] T025 [P] [US1] Create `app/Http/Requests/Employees/StoreEmployeeRequest.php` (authorize via policy; rules: name required, role `in:employee,captain,manager`, base_salary `gte:0`, commission_rate `numeric|gte:0`, hire_date date, `user_id` `nullable|exists:users,id|unique:employees,user_id`).
- [ ] T026 [P] [US1] Create `app/Http/Requests/Employees/UpdateEmployeeRequest.php` (same rules; `user_id` unique excluding current row).
- [ ] T027 [P] [US1] Create `app/Http/Resources/EmployeeResource.php` (envelope-compatible; `user` via `whenLoaded` using `UserSummaryResource`; conditional `commissions_summary`/`performance_summary`).
- [ ] T028 [US1] Create Actions `app/Actions/Employees/StoreEmployee.php` and `UpdateEmployee.php` (typed array input, persist, return model).
- [ ] T029 [US1] Create `app/Http/Controllers/Api/V1/EmployeeController.php` (index with Spatie Query Builder filters/sorts + cursor pagination, store, show with profile eager-loads, update, destroy guarded by restrict-on-delete).
- [ ] T030 [US1] Register employee routes in `routes/api/employees.php` under `auth:sanctum`; write endpoints throttled.
- [ ] T031 [US1] Run focused US1 tests — all green.

**Checkpoint**: Employee/captain roster fully functional and independently testable.

---

## Phase 4: User Story 2 - Commission Engine (Live + Backfill) (Priority: P1)

**Goal**: A commission is auto-created when a linked employee sells a subscription (P1) or sale (P2); an idempotent backfill generates commissions for historical data. Rate = `plan.commission_rate ?? employee.commission_rate` (subscriptions) / employee rate (sales); base = `price_paid`/`total`.

**Independent Test**: As a linked captain create a subscription + sale → assert two `pending` commissions with correct amounts → create one with an unlinked seller → assert none + skip logged → run `POST /commissions/backfill` over historical data → assert created count, then re-run → `created: 0`. Assert `GET /employees/{id}/commissions?month=` filter.

### Tests for US2

- [ ] T032 [P] [US2] Failing feature test: live trigger creates a commission on new subscription and on new sale for a linked employee, none for unlinked seller (`DB::afterCommit` path), in `tests/Feature/Api/V1/Commissions/CommissionLiveTriggerTest.php`.
- [ ] T033 [P] [US2] Failing feature test for `POST /commissions/backfill` (idempotent created→0 on re-run, `skipped_unlinked`, `already_present`, `dry_run`, 403) in `tests/Feature/Api/V1/Commissions/CommissionBackfillTest.php`.
- [ ] T034 [P] [US2] Failing feature test for `GET /employees/{id}/commissions?month=` (200, month filter, total amount in meta, 404, 403) in `tests/Feature/Api/V1/Employees/EmployeeCommissionsTest.php`.
- [ ] T035 [P] [US2] Failing unit test for `CalculateCommission` (rate resolution plan-override vs employee default; base = `price_paid`/`total`; skip unlinked seller; idempotency via `firstOrCreate`; correct `month`) in `tests/Unit/Actions/Commissions/CalculateCommissionTest.php`.

### Implementation for US2

- [ ] T036 [US2] Create `app/Models/Commission.php` (explicit `$fillable`, decimal casts, `LogsActivity` `useLogName('commissions')`, `belongsTo(Employee)`, `morphTo(source)`).
- [ ] T037 [P] [US2] Create `database/factories/CommissionFactory.php` (states for subscription-source and sale-source, pending/paid).
- [ ] T038 [P] [US2] Create `app/Http/Resources/CommissionResource.php` (source as `{ type, id }`, rate/amount strings, month).
- [ ] T039 [P] [US2] Create `app/Policies/CommissionPolicy.php` (view → `commissions.view`, backfill → `commissions.backfill`).
- [ ] T040 [US2] Create `app/Actions/Commissions/CalculateCommission.php` with `forSource(Subscription|Sale $source)`: resolve `Employee` by `user_id = source.sold_by_user_id`; skip+log (`info`) if unlinked or resolved rate is 0; resolve rate (`plan.commission_rate ?? employee.commission_rate` for subscriptions, employee rate for sales); `amount = bcmul(base, rate, 2)`; `firstOrCreate` on the source morph; `month` from `source.created_at`.
- [ ] T041 [US2] Create `app/Observers/SubscriptionObserver.php` and `app/Observers/SaleObserver.php` (each `created()` registers `DB::afterCommit(fn () => app(CalculateCommission::class)->forSource($model))`); register both in `app/Providers/AppServiceProvider::boot()`. **Do not modify** the Phase 1/2 models or Actions.
- [ ] T042 [US2] Create `app/Console/Commands/BackfillCommissionsCommand.php` (signature `commissions:backfill {--from=} {--to=} {--dry-run}`): chunk subscriptions then sales joined to linked employees lacking a commission, call `CalculateCommission`, return counts; idempotent via the unique index.
- [ ] T043 [US2] Create `app/Http/Controllers/Api/V1/CommissionController.php` (`backfill` invoking the command/action with counts; `index` for `/employees/{id}/commissions` with month filter + total in meta + cursor pagination).
- [ ] T044 [US2] Register routes: `POST /commissions/backfill` (throttled) in `routes/api/commissions.php`; `GET /employees/{id}/commissions` in `routes/api/employees.php`.
- [ ] T045 [US2] Run focused US2 tests — all green.

**Checkpoint**: Commissions auto-create live and backfill idempotently; per-employee commission listing works.

---

## Phase 5: User Story 3 - Payroll Generation (Priority: P1)

**Goal**: Generate payroll per active employee per month (`net = base + Σ commissions + bonuses − deductions`); adjust bonuses/deductions; mark paid atomically (commissions → paid, expense payout written); produce a payslip.

**Independent Test**: Seed an employee with base + 3 month commissions → `POST /payroll/generate?month=` → assert net = base + commissions → add bonus/deduction → net recomputes → reject negative net → `POST /payroll/{id}/pay` → commissions `paid` + `expenses` payout row exists → re-generate same month → no duplicate. Assert payslip JSON + PDF.

### Tests for US3

- [ ] T046 [P] [US3] Failing feature test for `POST /payroll/generate?month=` (200 per active employee, correct net, inactive excluded, idempotent re-run, 422 bad month, 403) in `tests/Feature/Api/V1/Payroll/PayrollGenerateTest.php`.
- [ ] T047 [P] [US3] Failing feature test for `PUT /payroll/{id}` (recompute net on bonuses/deductions, 422 negative net, 422 when already paid, 403) in `tests/Feature/Api/V1/Payroll/PayrollUpdateTest.php`.
- [ ] T048 [P] [US3] Failing feature test for `POST /payroll/{id}/pay` (status paid + paid_at, included commissions → paid, payroll-category expense written equal to net, 409 already paid, 403) in `tests/Feature/Api/V1/Payroll/PayrollPayTest.php`.
- [ ] T049 [P] [US3] Failing feature test for `GET /payroll?month=` and `GET /payroll/{id}/payslip` (JSON + `Accept: application/pdf` stream, 200/404/403) in `tests/Feature/Api/V1/Payroll/PayslipTest.php`.
- [ ] T050 [P] [US3] Failing unit tests for `GeneratePayroll` (net arithmetic, unique-month guard) and `MarkPayrollPaid` (atomic commissions→paid + expense payout, negative-net rejection) in `tests/Unit/Actions/Payroll/PayrollActionsTest.php`.

### Implementation for US3

- [ ] T051 [US3] Create `app/Models/Payroll.php` (table `payroll`, explicit `$fillable`, decimal casts, `paid_at` datetime, `LogsActivity` `useLogName('payroll')`, `belongsTo(Employee)`).
- [ ] T052 [P] [US3] Create `database/factories/PayrollFactory.php` (pending/paid states).
- [ ] T053 [P] [US3] Create `app/Http/Resources/PayrollResource.php` and `app/Http/Resources/PayslipResource.php` (payslip itemizes commissions + bonuses/deductions + net).
- [ ] T054 [P] [US3] Create `app/Policies/PayrollPolicy.php` (viewAny/view → `payroll.view`, generate → `payroll.generate`, update → `payroll.generate`, pay → `payroll.pay`).
- [ ] T055 [P] [US3] Create `app/Http/Requests/Payroll/GeneratePayrollRequest.php` (month `regex:/^\d{4}-\d{2}$/`) and `UpdatePayrollRequest.php` (bonuses/deductions `numeric|gte:0`).
- [ ] T056 [US3] Create Actions in `app/Actions/Payroll/`: `GeneratePayroll` (per active employee, `commissions_total = SUM(amount)` for month, `firstOrCreate` on `(employee_id, month)`, compute net), `UpdatePayroll` (recompute net, reject `< 0`, block when paid), `MarkPayrollPaid` (one `DB::transaction`: set paid + paid_at, mark month commissions paid, create `Expense` `category=payroll` amount=net date=today), `GeneratePayslip` (dompdf + HTML fallback).
- [ ] T057 [US3] Create `app/Http/Controllers/Api/V1/PayrollController.php` (generate, index with filters + cursor pagination, update, pay, payslip with content negotiation).
- [ ] T058 [US3] Register payroll routes in `routes/api/payroll.php` under `auth:sanctum`; `generate`/`pay` throttled.
- [ ] T059 [US3] Run focused US3 tests — all green.

**Checkpoint**: Payroll generates, adjusts, and pays atomically with an expense payout; payslip available.

---

## Phase 6: User Story 4 - Expense Tracking (Priority: P2)

**Goal**: Authorized managers CRUD operational expenses with category/amount/description/date, filterable by range and category. (Shared `Expense` model + factory already exist from Foundational.)

**Independent Test**: Create an expense → list filtered by date range and category → update → delete → confirm payroll payouts appear in the list. Assert 401/403/404.

### Tests for US4

- [ ] T060 [P] [US4] Failing feature tests for `GET/POST/PUT/DELETE /expenses` (list with date/category filters + total in meta, 201 attributed to creator, 200 update, 204 delete, 422 invalid amount/date, 401/403/404) in `tests/Feature/Api/V1/Expenses/ExpenseCrudTest.php`.

### Implementation for US4

- [ ] T061 [US4] Create `app/Policies/ExpensePolicy.php` (viewAny/view/create/update/delete → `expenses.*`).
- [ ] T062 [P] [US4] Create `app/Http/Requests/Expenses/StoreExpenseRequest.php` and `UpdateExpenseRequest.php` (category required, amount `numeric|gt:0`, date required date, description nullable).
- [ ] T063 [P] [US4] Create `app/Http/Resources/ExpenseResource.php` (creator via `whenLoaded`).
- [ ] T064 [US4] Create `app/Http/Controllers/Api/V1/ExpenseController.php` (index with Query Builder date/category filters + cursor pagination + total meta, store setting `created_by = auth id`, update, destroy).
- [ ] T065 [US4] Register expense routes in `routes/api/expenses.php` under `auth:sanctum`; write endpoints throttled.
- [ ] T066 [US4] Run focused US4 tests — all green.

**Checkpoint**: Expenses CRUD complete; payroll payouts visible in expense list.

---

## Phase 7: User Story 5 - Financial Reports (Priority: P2)

**Goal**: Revenue (paid `payments` only) − expenses = net profit, grouped by day/month over a range, reconciling exactly.

**Independent Test**: Seed paid + partial/due payments and expenses across dates → `GET /reports/financial?from=&to=&group_by=month` → assert revenue counts paid only, expenses include payroll payout, net reconciles, empty period returns zeros. Assert 403.

### Tests for US5

- [ ] T067 [P] [US5] Failing feature test for `GET /reports/financial` (paid-only revenue, expense inclusion of payouts, net reconciliation, group_by day/month, empty→zeros, 401/403) in `tests/Feature/Api/V1/Reports/FinancialReportTest.php`.
- [ ] T068 [P] [US5] Failing unit test for `FinancialReport` reconciliation across buckets in `tests/Unit/Actions/Reports/FinancialReconciliationTest.php`.

### Implementation for US5

- [ ] T069 [P] [US5] Create `app/Http/Requests/Reports/FinancialReportRequest.php` (from/to dates required, `group_by` `in:day,month`, default current month).
- [ ] T070 [US5] Create `app/Actions/Reports/FinancialReport.php` (revenue `SUM(payments.amount) WHERE status='paid'` grouped by `paid_at` bucket; expenses `SUM(expenses.amount)` by `date`; merge per period; net = revenue − expenses; JOIN/aggregate only, no correlated subqueries; totals in meta).
- [ ] T071 [US5] Add `financial()` to `app/Http/Controllers/Api/V1/ReportController.php` (new controller) returning the report via the envelope.
- [ ] T072 [US5] Register `GET /reports/financial` (`permission:reports.view`) in `routes/api/reports.php`.
- [ ] T073 [US5] Run focused US5 tests — all green.

**Checkpoint**: Financial report reconciles revenue − expenses = net profit.

---

## Phase 8: User Story 6 - Per-Employee Performance Reports (Priority: P2)

**Goal**: Per-employee sales count, subscriptions-sold count, and commissions earned for a period, attributed via `sold_by_user_id = employees.user_id`.

**Independent Test**: Seed subscriptions/sales/commissions across employees → `GET /reports/employees?from=&to=` and `GET /employees/{id}/performance` → assert counts and commission totals match seed and attribution is correct. Assert 403.

### Tests for US6

- [ ] T074 [P] [US6] Failing feature tests for `GET /reports/employees` and `GET /employees/{id}/performance` (accurate counts/commissions, correct attribution, period default, 401/403/404) in `tests/Feature/Api/V1/Reports/EmployeePerformanceTest.php`.

### Implementation for US6

- [ ] T075 [P] [US6] Create `app/Http/Requests/Reports/EmployeePerformanceRequest.php` (from/to optional, default current month).
- [ ] T076 [US6] Create `app/Actions/Reports/EmployeePerformanceReport.php` (JOIN `sales`/`subscriptions` on `sold_by_user_id = employees.user_id` + commissions sum; aggregate per employee; supports single-employee scope).
- [ ] T077 [US6] Add `employees()` to `ReportController` and `performance()` to `EmployeeController` reusing the action.
- [ ] T078 [US6] Register `GET /reports/employees` (`reports.view`) in `routes/api/reports.php` and `GET /employees/{id}/performance` in `routes/api/employees.php`.
- [ ] T079 [US6] Run focused US6 tests — all green.

**Checkpoint**: Per-employee performance accurate and attributable.

---

## Phase 9: User Story 7 - Admin Dashboard Summary (Priority: P3)

**Goal**: One cached `/dashboard/summary` returning active subscriptions, revenue MTD, expiring-soon, today's sales, top products, and a captain leaderboard ranked by current-month commissions.

**Independent Test**: Seed underlying data → `GET /dashboard/summary` → assert each KPI + leaderboard order → repeat call served from cache → create a commission → assert cache invalidated and leaderboard updates. Assert 403.

### Tests for US7

- [ ] T080 [P] [US7] Failing feature test for `GET /dashboard/summary` (all KPIs present, leaderboard ordering, cache hit + invalidation on new commission, 401/403) in `tests/Feature/Api/V1/Reports/DashboardSummaryTest.php`.

### Implementation for US7

- [ ] T081 [US7] Create `app/Actions/Reports/DashboardSummary.php` (active subs count, revenue MTD from paid payments, expiring-soon reuse Phase 1 action, sales-today + top-products reuse Phase 2 logic, captain leaderboard `SUM(commissions.amount)` by employee for current month ordered desc); cache under `dashboard:summary:v1` with ~60s TTL.
- [ ] T082 [US7] Add `Cache::forget('dashboard:summary:v1')` to `SubscriptionObserver`/`SaleObserver` (post-commit) and `MarkPayrollPaid` so leaderboard/revenue refresh on relevant writes.
- [ ] T083 [US7] Add `summary()` to `app/Http/Controllers/Api/V1/DashboardController.php` returning the cached aggregate via the envelope.
- [ ] T084 [US7] Register `GET /dashboard/summary` (`permission:reports.view`) by extending `routes/api/dashboard.php`.
- [x] T085 [US7] Run focused US7 tests — all green.

**Checkpoint**: Live dashboard with KPIs and captain leaderboard, cached with invalidation.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, review gates, and full-suite validation.

- [x] T086 [P] Sync endpoint docs with `specs/004-employees-payroll-reports/contracts/api.md`; confirm every endpoint's inputs/outputs/status/permission documented.
- [x] T087 [P] Run `vendor/bin/pint` and resolve all formatting.
- [x] T088 Security review (`laravel-security-reviewer`) → `reviews/security.md` — **PASS**; `$fillable` allowlists, policy gates, `throttle:sensitive` on backfill/generate/pay, bindings-only confirmed.
- [x] T089 Performance review (`laravel-performance-reviewer`) → `reviews/performance.md` — PASS WITH CONCERNS; JOIN-based reports (no correlated subqueries), mandated indexes present, dashboard cache + invalidation verified. Backfill N+1 probe fixed (batched); synchronous full-history backfill noted as a scale risk (CLI for large runs).
- [x] T090 Database-schema review (`database-schema-reviewer`) → `reviews/database-schema.md` and API-contract review (`api-contract-reviewer`) → `reviews/api-contract.md`. Schema FAIL blocker (seller-index `down()` duplicate-key) **fixed**; contract doc reconciled (offset pagination standard, expense `filter[...]` params, financial defaults).
- [x] T091 Final code review (`laravel-code-reviewer`) + `release-readiness-auditor` gate; full Pest suite green (360 passed) ✅; execute `quickstart.md` Scenarios 1–7 end to end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phases 3–9)**: All depend on Foundational.
  - **US1 (P1)** is the MVP and the roster other stories attribute to.
  - **US2 (P1)** depends on US1 (employees to attribute commissions).
  - **US3 (P1)** depends on US1 + US2 (sums commissions; uses shared `Expense` model from Foundational for payouts).
  - **US4 (P2)** independent (shared `Expense` model from Foundational).
  - **US5 (P2)** depends on US3/US4 data existing for full reconciliation (expenses incl. payouts) but the report code is independent.
  - **US6 (P2)** depends on US1 + US2 (attribution + commissions).
  - **US7 (P3)** depends on US2 (leaderboard) + US5 (revenue) aggregates.
- **Polish (Phase 10)**: After all desired stories complete.

### Within Each User Story

- Tests written first and FAIL before implementation.
- Models → factories/policies/requests/resources (parallel) → Actions → Controller → routes → run tests.

### Parallel Opportunities

- Setup T003 after T001/T002.
- Foundational migrations **T007–T013 all [P]**; `Expense` model/factory T017/T018 [P]; after T014 migrate, edits T015/T016 [P].
- Within each story, all test tasks [P] and all model/factory/policy/request/resource tasks marked [P] run together.
- After Foundational, **US1 → US2 → US3** proceed in priority order; **US4, US5, US6** can be staffed in parallel once their dependencies land; **US7** last.

---

## Parallel Example: User Story 1

```bash
# Tests first (all parallel):
Task: "EmployeeIndexTest.php"      # T019
Task: "EmployeeStoreTest.php"      # T020
Task: "EmployeeUpdateTest.php"     # T021

# Then parallel scaffolding:
Task: "EmployeeFactory.php"        # T023
Task: "EmployeePolicy.php"         # T024
Task: "StoreEmployeeRequest.php"   # T025
Task: "UpdateEmployeeRequest.php"  # T026
Task: "EmployeeResource.php"       # T027
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → **STOP & VALIDATE** the roster independently → demo.

### Incremental Delivery

Foundation → US1 (roster MVP) → US2 (commissions live + backfill) → US3 (payroll) → US4 (expenses) → US5 (financial report) → US6 (performance) → US7 (dashboard). Each story is independently testable and demoable.

### Notes

- [P] = different files, no dependency on an incomplete task.
- Verify each test fails before implementing.
- Commit after each task or logical group; run `vendor/bin/pint` before committing.
- Do not modify Phase 1/2 models or Actions — commission triggers attach via observers registered in `AppServiceProvider`.
