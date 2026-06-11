# Phase 3 Performance Review — Employees, Payroll, Commissions & Reports

**Branch:** `004-employees-payroll-reports`
**Scope:** `git diff fef5e76..HEAD` (commits `7d34163`, `7f7890a`, `82b8174`)
**Standard:** Constitution Principle VI (Performance) + Performance gates; plan/research D6, D7, D9.
**Reviewer:** laravel-performance-reviewer
**Date:** 2026-06-11

---

## Verdict: PASS WITH CONCERNS

The phase is built to its own performance spec: reports use JOIN + aggregate (no correlated subqueries), the heavy report/list endpoints are paginated, the mandated composite indexes are all present, the dashboard is cached with explicit invalidation, and the `MarkPayrollPaid` reconciliation is a single bounded query, not an N+1. There is **one** finding that should be addressed before this is considered production-safe at scale (the synchronous backfill in the request path), plus a small set of non-blocking optimizations.

---

## Blocking Findings

### B1 — `commissions:backfill` runs unbounded historical work synchronously in the HTTP request
**File:** `app/Http/Controllers/Api/V1/CommissionController.php:48-64` → `app/Console/Commands/BackfillCommissionsCommand.php:34-149`

`CommissionController::backfill()` instantiates the command and calls `executeBackfill()` inline in the request lifecycle. That method chunks **every historical subscription and sale** for all linked sellers (`whereIn('sold_by_user_id', $linkedUserIds)`), and for each row issues an idempotency `exists()` check plus, on a miss, a full `CalculateCommission::forSource()` (which itself runs `Employee::where('user_id')->first()`, loads `plan`, and a `firstOrCreate`). On a gym with tens of thousands of historical sales+subscriptions this is thousands of queries in one web request — it will blow past `max_execution_time` / PHP-FPM / proxy timeouts and hold a worker hostage. This is exactly the "queue heavy work (... heavy aggregation, third-party calls, exports)" case in Principle VI, and the CLI entry point (`commissions:backfill`) already exists as the safe path.

**Fix (pick one, in order of preference):**
1. **Queue it.** Wrap the backfill in a `ShouldQueue` job dispatched from the controller; return `202 Accepted` with a status handle. The chunking already makes it queue-friendly.
2. If a job is judged YAGNI for now, **restrict the HTTP endpoint to a bounded window** (require `from`/`to`, cap the span) and document that full historical backfill is CLI-only (`php artisan commissions:backfill`). The unbounded full-history run must not be reachable from a web request.

At minimum this must be a conscious, documented decision — right now an authorized client calling `POST .../commissions/backfill` with no `from`/`to` triggers a full-table historical scan synchronously.

### B2 — N+1 inside the backfill idempotency check (compounds B1)
**File:** `app/Console/Commands/BackfillCommissionsCommand.php:60-63, 110-113`

Per scanned row the loop runs `Commission::where('source_type', ...)->where('source_id', ...)->exists()`. That is one query **per row** purely to decide whether to skip — `1 + N` on top of the per-row work in `CalculateCommission`. `firstOrCreate` (D4's unique index on `commissions(source_type, source_id)`) already makes creation idempotent, so the pre-check is redundant for correctness; it exists only to populate the `already_present` counter.

**Fix:** Drop the per-row `exists()`. Per chunk, fetch the set of already-commissioned source ids in one query and diff in PHP:
```php
$existingIds = Commission::where('source_type', Subscription::class)
    ->whereIn('source_id', $subscriptions->pluck('id'))
    ->pluck('source_id')
    ->all();
```
Then `in_array($subscription->id, $existingIds, true)` for the counter. This turns `N` skip-probe queries per chunk into `1`. (On a CLI run this is a throughput win; combined with B1's queueing it keeps the job cheap.)

---

## Non-Blocking Optimizations

### N1 — `CalculateCommission` re-queries the employee for every source; backfill could pre-map
**File:** `app/Actions/Commissions/CalculateCommission.php:27` (called per row from backfill)

`Employee::where('user_id', $userId)->first()` runs once per source. The live observer path (one source per request) is fine and should stay as-is. But the **backfill** already computes `$linkedUserIds` from `Employee::whereNotNull('user_id')`; it could build a `user_id => Employee` map once (`Employee::whereNotNull('user_id')->get()->keyBy('user_id')`) and pass the resolved employee in, eliminating one query per scanned row. Optional — only worth it if backfill stays in a request path (B1) or runs over very large history. Live path: **do not change** (YAGNI, single-row).

### N2 — `PayslipResource` issues a commissions query on every render
**File:** `app/Http/Resources/PayslipResource.php:17-19`

The resource self-loads `Commission::where('employee_id')->where('month')->get()` inside `toArray()`. For the single-payslip endpoint (`PayrollController::payslip`) this is exactly one extra query and is fine. Flagging only as a latent 1+N: if a payslip collection is ever rendered, this becomes `1 + N`. Keep it single-use; if a list view is added, eager-load commissions on the payroll query instead. The `commissions(employee_id, month, status)` index covers this `WHERE` (leading `employee_id, month`), so the single query is index-served.

### N3 — `PayrollController::generate` runs an extra `Employee::active()->count()` after generation
**File:** `app/Http/Controllers/Api/V1/PayrollController.php:57`

`GeneratePayroll::execute()` already loaded all active employees (`Employee::active()->get()`), then the controller runs a second `Employee::active()->count()` to compute `skipped`. Minor: have the action return the active count (or `count($activeEmployees)`) so the second aggregate query is avoided. One query saved per generate call — negligible but free.

### N4 — `GeneratePayroll` loads all active employees with `get()` (acceptable, noted per request)
**File:** `app/Actions/Payroll/GeneratePayroll.php:18`

`Employee::active()->get()` is an unbounded load over a **bounded** table — gym staff headcount is small (tens, not thousands), and payroll generation is an admin batch action, not a hot path. **Acceptable.** The per-employee `exists()` (`:23-25`) and `sum('amount')` (`:32-35`) are each index-served (`payroll(employee_id, month)` unique; `commissions(employee_id, month, status)`). If staff ever grows large, convert to `chunk()` — not needed now.

### N5 — Financial report groups revenue on `paid_at` via `DATE()`/`DATE_FORMAT()` — function on column blocks index range use
**File:** `app/Actions/Reports/FinancialReport.php:28-32, 36-44`

The revenue query filters `whereBetween('paid_at', [...])` (sargable, uses `payments(status, paid_at)`) and then `GROUP BY DATE_FORMAT(paid_at, ...)`. The `WHERE` is index-supported, so the range scan is bounded; the `DATE_FORMAT` only applies to the already-filtered rows for grouping, which is correct and the right trade-off (you cannot avoid a derived grouping expression here). **No change needed** — the leading-column `status` + `paid_at` range is what matters and it's covered. Same pattern on `expenses(date)` index. Documenting so a future reviewer doesn't mistake the `DATE_FORMAT` for a full-scan.

### N6 — `Model::preventLazyLoading()` still not enabled (carried from Phase 0)
Phase 3 adds the first real collection endpoints rendering eager-loadable relations (`EmployeeController::index` with `user`, `PayrollController::index` with `employee`). Both correctly eager-load, so there is no live N+1. But enabling `Model::preventLazyLoading(! app()->isProduction())` in `AppServiceProvider::boot()` would turn any future missing eager-load into a loud failure in dev/CI instead of a silent prod 1+N. Recommended now that collection endpoints exist. (Carry-over from `[[userresource-spatie-lazyload]]`.)

---

## N+1 / Resource Render Audit

| Endpoint | Resource | Relation rendered | Eager-loaded? | Verdict |
|---|---|---|---|---|
| `EmployeeController::index` | EmployeeResource | `user` (`whenLoaded`) | yes — `->with(['user'])` | clean |
| `EmployeeController::show/store/update` | EmployeeResource | `user` | yes — `->load('user')` | clean |
| `PayrollController::index` | PayrollResource | `employee` | yes — `->with('employee')` | clean |
| `PayrollController::payslip` (JSON) | PayslipResource | `employee` + commissions query | `employee` loaded; commissions = 1 query (single payslip) | clean (N2 latent) |
| `CommissionController::index` | CommissionResource | none (only `employee_id` scalar) | n/a | clean |
| `ExpenseController::index` | ExpenseResource | `creator` (`whenLoaded`) | yes — `->with(['creator'])` | clean |
| `ReportController::employees` | raw rows (JOINs) | none | n/a — single aggregate query | clean |
| `ReportController::financial` | raw aggregate | none | n/a — 2 aggregate queries total | clean |
| `DashboardController` | array (cached) | none | n/a — 6 aggregates, cached 60s | clean |

`EmployeeResource` renders `name`/`phone` — both are columns on the `employees` table itself (confirmed in migration), so no JOIN/relation needed. No N+1 in any live Resource path.

---

## JOIN vs Correlated Subquery Audit (D6 — mandate: JOIN + aggregate, no correlated subqueries)

| Action | Technique | Compliant? |
|---|---|---|
| `FinancialReport` | 2 independent grouped aggregate queries (payments, expenses), merged in PHP over a generated period range | yes — no subqueries, two index-served scans |
| `EmployeePerformanceReport` | `leftJoinSub` derived tables (sales count, subs count, commissions sum) joined to employees+users | yes — derived tables, **not** correlated subqueries |
| `DashboardSummary` | direct `join` + `groupBy` aggregates (leaderboard, top products) | yes |
| `BackfillCommissionsCommand` | chunked scans, no subqueries | yes (but see B1/B2) |

D6 satisfied across all reports.

---

## Index Coverage Table

| Query (file) | Filter / join / sort column(s) | Index present? | Notes |
|---|---|---|---|
| Revenue agg — `FinancialReport:36-44`, `DashboardSummary:29-32` | `payments(status, paid_at)` range | **y** | `200500` migration `index(['status','paid_at'])` |
| Per-source payment lookup (phase-mandated) | `payments(payable_type, payable_id, status)` | **y** | `200500` migration |
| Commission payroll sum — `GeneratePayroll:32`, `MarkPayrollPaid:37-42` | `commissions(employee_id, month, status)` | **y** | `200100` migration composite |
| Commission idempotency — `CalculateCommission:70`, backfill `60/110` | `commissions(source_type, source_id)` unique | **y** | `200100` unique |
| Commission list — `CommissionController:23,31` | `commissions(employee_id [, month])`, `ORDER BY created_at` | **y (filter)** | leading `employee_id, month` covers WHERE; `ORDER BY created_at DESC` sorts within the (small) per-employee set — acceptable, not separately indexed |
| Per-employee sales count — `EmployeePerformanceReport:27-29` | `sales(sold_by_user_id, created_at)` | **y** | `200600` migration |
| Per-employee subs count — `EmployeePerformanceReport:37-39` | `subscriptions(sold_by_user_id)` + `created_at` range | **partial** | `200600` indexes `sold_by_user_id` only; the `created_at` range filters within seller — acceptable (seller is the selective leading column per D6 note), but unlike `sales` there is no composite. See note below. |
| Commissions sum (perf report) — `EmployeePerformanceReport:46-49` | `commissions(employee_id)` + `created_at` range | **y (leading)** | `commissions(employee_id, month, status)` covers `employee_id`; range is on `created_at` not `month` — filters within employee, acceptable |
| Leaderboard — `DashboardSummary:81-91` | `commissions(month)` + join employee/user | **partial** | `commissions(employee_id, month, status)` has `month` as a **non-leading** column, so `WHERE month = ?` cannot seek on it; this scans. Bounded (one month of commissions) — acceptable, see note |
| Expense report grouping — `FinancialReport:47-54` | `expenses(date)` range | **y** | `200300` `->index()` on `date` |
| Expense filters — `ExpenseController:22-32` | `expenses(category)`, `expenses(date)` sort/filter | **y** | both indexed (`200300`) |
| Employee link resolution — `CalculateCommission:27`, backfill | `employees(user_id)` unique | **y** | `200000` `->unique()` |
| Payroll dedupe — `GeneratePayroll:23`, `MarkPayrollPaid` | `payroll(employee_id, month)` unique | **y** | `200200` unique |
| Payroll list filters — `PayrollController:27-35` | `payroll(month, status)`, `employee_id` | **y** | `200200` `index(['month','status'])`; `employee_id` has FK index |
| Sales today / top products — `DashboardSummary:44-71` | `sales(status, created_at)` (Phase 2), `sale_items.sale_id`/`product_id` | **y (pre-existing)** | per research D6 these exist from Phase 2 |

**Index notes (non-blocking):**
- **`subscriptions(sold_by_user_id)` lacks the `created_at` tail** that `sales` got. The performance-report subquery filters `sold_by_user_id` then ranges `created_at`. Functionally fine (seller is selective), but for symmetry with `sales(sold_by_user_id, created_at)` and to keep the `created_at` range index-served, consider `subscriptions(sold_by_user_id, created_at)`. Low priority — subscription volume per seller is modest.
- **Leaderboard `WHERE commissions.month = ?`** cannot use the composite (month is column 2). It scans all commissions for the month after the join. Bounded by one month of data and the result is cached 60s (D9), so impact is small. If the leaderboard ever feels slow at scale, add `commissions(month)` or reorder a dedicated index — not warranted now.

---

## `MarkPayrollPaid` Reconciliation Assessment (the recent fix)

**File:** `app/Actions/Payroll/MarkPayrollPaid.php:26-91`

- **Not an N+1.** The pending commissions are fetched in **one** query (`:37-42`) with `lockForUpdate()`; the reduce loop (`:44-47`) is pure in-memory `bcadd` over the already-fetched collection — zero queries inside the loop. The subsequent flip is a **single** bulk `update(...whereKey($modelKeys))` (`:73-77`), not a per-row save. Correct.
- **Lock scope is correct and minimal.** `lockForUpdate()` is scoped to exactly the rows being settled (`employee_id` + `month` + `status='pending'`), the index `commissions(employee_id, month, status)` makes that a tight indexed row-lock range (not a table/gap-heavy scan), and the whole thing runs inside `DB::transaction`. This is the right tool to prevent the documented race (live observer inserting late commissions for the same month while payroll is being paid) — it guarantees the sum, the net recompute, and the flip see a consistent set.
- **Bounded N.** Pending commissions per employee per month = number of sales/subscriptions that seller closed that month. Small. The reduce/flip cost is linear in that and negligible.
- **Cache invalidation correct.** `Cache::forget('dashboard:summary:v1')` (`:88`) fires inside the transaction after the writes; the dashboard recomputes leaderboard/revenue on next hit. Matches D9. (Minor: forgetting inside the transaction means a rollback would still have evicted the cache — harmless here, it just forces one recompute.)

**Verdict on the fix: correct and performant.** No change required.

---

## Queue / Sync Assessment

| Operation | Current | Assessment |
|---|---|---|
| Live commission write (observer) | sync via `DB::afterCommit` | **correct** — sub-ms arithmetic + single insert; queuing is YAGNI per D1 |
| Dashboard cache forget (observers, MarkPayrollPaid) | sync | correct — cheap key eviction |
| **`commissions:backfill` via HTTP** | **sync, unbounded** | **B1 — must queue or bound** |
| Payslip PDF (`GeneratePayslip`) | sync (dompdf render) | acceptable — single-doc, on-demand download; only queue if batch payslip generation is added |
| Payroll generation | sync over bounded staff set | acceptable (N4) |
| `MarkPayrollPaid` | sync, single txn | correct |

---

## Pagination Assessment (D7)

- `EmployeeController::index` — `paginate(15)` offset. OK (employee table bounded).
- `CommissionController::index` — `paginate(15)` offset, scoped to one employee. OK.
- `PayrollController::index` — `paginate(15)` offset. OK.
- `ExpenseController::index` — `cursorPaginate(15)` keyset. Good — expenses grow unbounded, keyset is the right call per D7.
- `EmployeePerformanceReport` (list) — `cursorPaginate(15)` keyset. Good.
- `FinancialReport` / `DashboardSummary` — bounded aggregate sets returned whole. Correct per D7 (grouped buckets are small).

No unbounded `get()` on a growable table in any **request** path. (Backfill's chunked `get()` is CLI-appropriate but see B1.)

---

## Summary of Required Actions

1. **B1 (blocking):** Queue the HTTP backfill, or restrict it to a bounded `from`/`to` window and document full-history backfill as CLI-only. Unbounded historical scan must not run synchronously in a web request.
2. **B2 (blocking, cheap):** Replace the per-row `Commission::...->exists()` skip-probe in the backfill with a per-chunk `whereIn(...)->pluck()` diff — removes the N+1.

Everything else (N1–N6, index tail notes) is optional polish. Reports, indexes, caching, pagination, and the `MarkPayrollPaid` reconciliation all meet the Phase 3 performance spec.
