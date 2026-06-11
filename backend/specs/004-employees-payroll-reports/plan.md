# Implementation Plan: Employees, Payroll, Commissions & Reports

**Branch**: `004-employees-payroll-reports` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Phase 3 from `phases/Phase-3-Employees-Payroll-Reports.md`, building on Phase 0 (auth/permissions/audit/settings), Phase 1 (`subscriptions`, polymorphic `payments`, `sold_by_user_id`), Phase 2 (`sales`, `sale_items`, `sold_by_user_id`, sale `payments`).

## Summary

Build the HR + finance layer on top of Phases 0–2. Five capability groups: **Employees/Captains** (CRUD, optional unique link to a `users` account, base salary + commission rate); a **Commission engine** that auto-creates a commission whenever a subscription (P1) or sale (P2) is sold by a linked employee, **plus** an idempotent backfill command for historical data; **Payroll** generation per employee per month (`net = base + Σ commissions + bonuses − deductions`) where marking paid writes an expense; **Expenses** CRUD; and read-heavy **Reports** — financial (revenue − expenses = net profit, revenue from *paid* payments only), per-employee performance, and a cached **dashboard summary** with a captain leaderboard.

The work is Laravel-native throughout: Eloquent, Form Requests, Policies, API Resources, Eloquent **observers** for the live commission trigger, an Artisan **command** for backfill, the existing polymorphic `payments` contract as the single revenue source, and the Redis cache for hot dashboard aggregates. **No new packages.** The commission engine links to P1/P2 transactions via `employees.user_id = sold_by_user_id` — honoring the cross-phase contract without forking payment logic or modifying Phase 1/2 Actions.

## Technical Context

**Language/Version**: PHP 8.4+, Laravel 12. Run tooling with `~/.config/herd-lite/bin/php` if the PATH `php` is 8.2 (fails the platform check).

**Primary Dependencies** (all already installed — no additions):
- `laravel/sanctum` — auth
- `spatie/laravel-permission` — RBAC (`employees.*`, `commissions.*`, `payroll.*`, `expenses.*`, reuse `reports.view`)
- `spatie/laravel-activitylog` — audit (`LogsActivity` on Employee, Commission, Payroll, Expense)
- `spatie/laravel-query-builder` — list filtering/sorting on index endpoints
- `barryvdh/laravel-dompdf` — payslip PDF (installed Phase 0)
- `pestphp/pest` + laravel plugin — test-first

**Storage**: MySQL (production); SQLite in-memory (tests). Four new tables: `employees`, `commissions`, `payroll`, `expenses`. Three additive modifications: `plans.commission_rate` (plan-level rate override), composite indexes on `payments` and `sales`/`subscriptions` for the heavy report read-paths. Reuses `payments`, `subscriptions`, `sales`, `sale_items`, `plans`, `users`, `settings`.

**Testing**: Pest only. SQLite in-memory, `sync` queue, `array` cache/session. Test-first: failing test → implement → green. Heaviest test focus (per phase): commission calc + backfill idempotency, payroll totals, revenue/net reconciliation.

**Target Platform**: Backend REST API only, `/api/v1`.

**Performance Goals**: No N+1; report queries use **JOINs + aggregates** (no correlated subqueries, no PHP-side aggregation of large sets); composite indexes on every queried/joined/FK column (`commissions(employee_id, month, status)`, `payments(status, paid_at)` + `(payable_type, payable_id, status)`, `sales(sold_by_user_id, created_at)`, `subscriptions(sold_by_user_id)`); **keyset/cursor pagination** for large lists; dashboard aggregates cached in Redis with short TTL + explicit invalidation.

**Constraints**: Monetary values `decimal(10,2)`, computed with `bcmath` (matches Phase 1/2). `commission_rate` stored as `decimal(5,4)` fraction (e.g. `0.1000` = 10%). `month` stored as `char(7)` `YYYY-MM` for cheap, indexable grouping. Live commission creation runs in `DB::afterCommit` of the source write so a captain-config issue can never roll back a sale/subscription (FR-012 skip-and-log). Backfill is idempotent via a unique `(source_type, source_id)` index. Marking payroll paid is atomic (status + commissions→paid + expense payout in one transaction).

**Scale/Scope**: 4 new tables + 3 additive migrations, ~14 endpoints across 7 user stories, ~9 Actions (`CalculateCommission`, `GeneratePayroll`, `MarkPayrollPaid`, `UpdatePayroll`, `GeneratePayslip`, `FinancialReport`, `EmployeePerformanceReport`, `DashboardSummary`, plus employee/expense store/update), 1 Artisan command (`commissions:backfill`), 2 observers (Subscription, Sale).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — PASS.*

| Principle | How this plan complies |
|-----------|------------------------|
| **I. Laravel-First** | Eloquent, Form Requests, Policies, API Resources, Observers, Artisan command, dompdf, Redis cache, `LogsActivity` — all native/already-installed. No new package. The live commission trigger uses Eloquent model events, not a custom dispatcher. |
| **II. Thin Transport** | Controllers: validate (Form Request) → authorize (Policy) → call Action → return Resource. All logic in `Actions/Commissions`, `Actions/Payroll`, `Actions/Expenses`, `Actions/Reports`. Actions take typed inputs (`string $month`, `array $data`, model instances), never the Request. |
| **III. Test-First Pest** | Every endpoint: feature tests (happy/422/401/403/404). Unit tests for commission rate-resolution + amount, backfill idempotency, payroll arithmetic, negative-net guard, revenue/net reconciliation. Written first. |
| **IV. Versioned Contract** | All routes under `/api/v1`. Reuses the `{ data, meta, message }` envelope and error shape. Cursor pagination meta consistent with Phase 2 reports. |
| **V. Security by Default** | Explicit `$fillable` on every model; `employees.*`/`payroll.*`/etc. permission on every endpoint + Policy; `employee.user_id` uniqueness enforced; rates/salary/amounts never trusted from client for authorization; backfill + payroll-generate are write-heavy → rate-limited; bindings only. |
| **VI. Performance** | JOIN-based aggregates (no correlated subqueries — explicit phase mandate); composite indexes listed above; cursor pagination; dashboard cached with intentional key + invalidation; commission write dispatched post-commit. |
| **VII. YAGNI** | No repository pattern; Actions over ceremony. Attendance dropped (optional → out of scope). Product-level commission override dropped (plan-level only, per clarification). Reuse `reports.view` rather than inventing granular report perms. No frontend. |

**Gate Result**: **PASS**. No violations. (See Complexity Tracking — empty.)

## Cross-Phase Contract Preservation

1. **`employees.user_id` → `users.id`** (nullable, **unique**, `nullOnDelete`). This is the bridge that resolves the `sold_by_user_id` captured on P1 subscriptions and P2 sales. No change to `sold_by_user_id` columns.
2. **`payments` is the single revenue source** — financial reports read `payments WHERE status = 'paid'` across both `payable_type` values (Subscription, Sale). No schema change to `payments` beyond an additive read-path index. Payment logic is **not** forked.
3. **Commission source is polymorphic** (`source_type`/`source_id` → Subscription | Sale), mirroring the established `payments` morph pattern.
4. **Outputs exposed for Phase 4**: payroll/report payloads (Phase 4 wires multi-format export), dashboard data (Phase 4 applies branding tokens), and all HR/finance permissions (Phase 4 folds them into the final matrix + Accountant/Manager presets).

## Project Structure

### Documentation (this feature)

```text
specs/004-employees-payroll-reports/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions & rationale
├── data-model.md        # Phase 1 — entities, columns, indexes, state transitions
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/
│   └── api.md           # Phase 1 — endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist (done)
└── tasks.md             # Phase 2 — created by /speckit-tasks (NOT here)
```

### Source Code (additions only)

```text
app/
├── Actions/
│   ├── Commissions/        # CalculateCommission
│   ├── Payroll/            # GeneratePayroll, UpdatePayroll, MarkPayrollPaid, GeneratePayslip
│   ├── Expenses/           # StoreExpense, UpdateExpense
│   ├── Employees/          # StoreEmployee, UpdateEmployee
│   └── Reports/            # FinancialReport, EmployeePerformanceReport, DashboardSummary
│                           #   (Reports/ already exists from Phase 2 — add files)
├── Console/Commands/       # BackfillCommissionsCommand (commissions:backfill)
├── Observers/              # SubscriptionObserver, SaleObserver  (live commission trigger)
├── Http/
│   ├── Controllers/Api/V1/ # EmployeeController, CommissionController, PayrollController,
│   │                       #   ExpenseController, ReportController, (extend DashboardController)
│   ├── Requests/           # Employees/, Payroll/, Expenses/, Reports/ Form Requests
│   └── Resources/          # EmployeeResource, CommissionResource, PayrollResource,
│                           #   ExpenseResource, PayslipResource
├── Models/                 # Employee, Commission, Payroll, Expense
│                           #   (+ additive: User::employee(), Plan::$fillable commission_rate)
├── Policies/               # EmployeePolicy, CommissionPolicy, PayrollPolicy, ExpensePolicy
├── Providers/              # AppServiceProvider — register observers + dashboard cache-forget
└── Support/                # HrFinancePermissions  (parallel to PosPermissions)

database/
├── factories/              # Employee, Commission, Payroll, Expense factories
├── migrations/             # 4 new tables + add_commission_rate_to_plans
│                           #   + add_report_indexes_to_payments/sales/subscriptions
└── seeders/                # HrFinanceAccessSeeder (+ register in DatabaseSeeder)

routes/
└── api/
    ├── employees.php       # employees CRUD + /{id}/commissions + /{id}/performance
    ├── commissions.php     # /commissions/backfill
    ├── payroll.php         # generate + index + /{id}/payslip + /{id}/pay
    ├── expenses.php        # expenses CRUD
    ├── reports.php         # /reports/financial + /reports/employees
    └── dashboard.php       # extend: add /dashboard/summary
    # all new files required in routes/api.php inside the /api/v1 auth group

tests/
├── Feature/Api/V1/
│   ├── Employees/          # EmployeeStoreTest, EmployeeUpdateTest, EmployeeCommissionsTest,
│   │                       #   EmployeePerformanceTest
│   ├── Payroll/            # PayrollGenerateTest, PayrollPayTest, PayslipTest
│   ├── Expenses/           # ExpenseCrudTest
│   ├── Commissions/        # CommissionBackfillTest, CommissionLiveTriggerTest
│   └── Reports/            # FinancialReportTest, DashboardSummaryTest
└── Unit/Actions/
    ├── Commissions/        # CalculateCommissionTest (rate resolution, amount, skip-unlinked)
    ├── Payroll/            # GeneratePayrollTest, MarkPayrollPaidTest (net math, negative guard)
    └── Reports/            # FinancialReconciliationTest
```

**Structure Decision**: Single Laravel project, extending the Phase 0–2 layout. New `Actions/Commissions|Payroll|Expenses|Employees` namespaces mirror `Actions/Members|Subscriptions|Sales`. `HrFinancePermissions` parallels `PosPermissions`/`MembershipPermissions`. Observers registered in `AppServiceProvider::boot()` so **Phase 1/2 models and Actions are not modified** (except two additive lines: `User::employee()` relation and `Plan` `commission_rate` fillable/cast).

## Live Commission Trigger — design decision

The phase requires a commission "on a new subscription (P1) or sale (P2)". Two clean options were weighed (full rationale in `research.md`):

- **Chosen**: Eloquent **observers** (`SubscriptionObserver::created`, `SaleObserver::created`) registered in `AppServiceProvider`. Each registers `DB::afterCommit(fn () => app(CalculateCommission::class)->forSource($model))`. The commission is written in its own transaction **after** the source commits — a misconfigured/unlinked captain logs-and-skips (FR-012) and can never roll back the sale/subscription. Zero edits to Phase 1/2 Actions.
- **Rejected**: calling `CalculateCommission` inline inside the existing `CreateSubscription`/`CreateSaleAction` transactions — couples P3 into P1/P2 files and risks a commission failure rolling back revenue.

Idempotency (shared by the live path and the backfill) is guaranteed by `firstOrCreate` on the unique `(source_type, source_id)` index, so the live trigger and `commissions:backfill` are safe to run in any order, repeatedly.

## Rate Resolution & Commission Base (from clarifications)

- **Eligible transactions**: both subscription sales **and** POS/product sales (clarified).
- **Rate**: `source-level rate ?? employee.commission_rate`. Source-level override exists only for **subscriptions** via the new nullable `plans.commission_rate`; **sales** use the employee rate (a sale spans multiple products, so a single per-sale override is ambiguous — product-level override is explicitly out of scope, documented in research.md).
- **Base**: subscription → `price_paid` (realized, post-discount); sale → `total`. Both are realized revenue.
- **Month**: derived from the source `created_at` → `YYYY-MM` (the period the commission was earned).
- **Eligibility**: only employees whose role is commission-eligible (`captain`, or any with a non-zero resolved rate) earn; unlinked sellers are skipped and logged.

## Implementation Phasing (maps to spec user stories)

1. **Foundational**: `HrFinancePermissions` + `HrFinanceAccessSeeder`; 4 new-table migrations + `plans.commission_rate` + report-index migrations; factories; register observers in `AppServiceProvider`.
2. **US1 Employees** (P1 blocker): Employee model/policy/requests/resource/controller; unique `user_id` link; `User::employee()`; profile endpoint shell.
3. **US2 Commission engine** (P1 core): `CalculateCommission` (resolve employee → rate → base → `firstOrCreate` commission) + observers (live) + `BackfillCommissionsCommand` (historical, idempotent) + `/commissions/backfill` + `/employees/{id}/commissions`.
4. **US3 Payroll** (P1): `GeneratePayroll` (per active employee/month, unique guard, net math) + `UpdatePayroll` (bonuses/deductions, negative-net guard) + `MarkPayrollPaid` (atomic: status + commissions→paid + expense payout) + `GeneratePayslip` (dompdf + HTML) + endpoints.
5. **US4 Expenses** (P2): Expense model/policy/requests/resource/controller + CRUD with date/category filters.
6. **US5 Financial reports** (P2): `FinancialReport` (revenue from paid `payments`, expenses from `expenses`, net; grouped day/month/range; JOIN aggregates) + `/reports/financial`.
7. **US6 Performance reports** (P2): `EmployeePerformanceReport` (sales/subs counts + commissions via JOIN on `sold_by_user_id = employees.user_id`) + `/reports/employees` + `/employees/{id}/performance`.
8. **US7 Dashboard** (P3): `DashboardSummary` (active subs, revenue MTD, expiring-soon, sales today, top products, captain leaderboard) + `/dashboard/summary`, Redis-cached with explicit forget on commission/sale writes.
9. **Polish**: docs sync, Pint, full suite green, review gates.

## Review Gates (mandatory workflow — CLAUDE.md)

1. Analyze requirements against Phase 3 doc + Constitution. ✅ (this plan)
2. `laravel-architecture-reviewer` **before** writing code.
3. `laravel-feature-engineer` — test-first implementation.
4. Full Pest suite green.
5. `laravel-security-reviewer`.
6. `laravel-performance-reviewer` (heaviest queries in the project — explicit focus).
7. `laravel-code-reviewer` + `release-readiness-auditor` (final gate). `database-schema-reviewer` on the migrations; `api-contract-reviewer` on the new endpoints.

## Out of Scope

- All frontend (`/employees`, `/payroll`, `/expenses`, `/reports`, `/dashboard` pages, charts, leaderboard UI).
- **Attendance** (phase-optional) — table and metrics deferred; performance report excludes attendance.
- **Product-level** commission override — plan-level only this phase.
- Multi-format export (PDF/Excel) and final branding for payslips/reports — Phase 4 (basic payslip PDF + JSON/CSV here).
- Final permission matrix + role-preset polish — Phase 4.
- Partial-month payroll proration — full base per processed month.
- Auto-reversal of commissions on void/refund — the discrepancy is **surfaced** (flag/report), not silently mutated.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | N/A | N/A |
