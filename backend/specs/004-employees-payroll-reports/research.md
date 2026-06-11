# Phase 0 — Research & Decisions: Employees, Payroll, Commissions & Reports

All NEEDS CLARIFICATION items from the spec were resolved with the client during `/speckit-specify`. This document records the design decisions, their rationale, and the alternatives rejected — grounded in the actual Phase 0–2 codebase.

---

## D1. Live commission trigger mechanism

**Decision**: Eloquent **observers** (`SubscriptionObserver`, `SaleObserver`) registered in `AppServiceProvider::boot()`. Each `created()` hook registers `DB::afterCommit(fn () => app(CalculateCommission::class)->forSource($model))`.

**Rationale**:
- Framework-native (Principle I) and **decoupled** — Phase 1 `CreateSubscription` and Phase 2 `CreateSaleAction` are left untouched. Both already wrap their writes in `DB::transaction`; `CreateSaleAction` already uses `DB::afterCommit` for `NewSaleEvent`, so the post-commit pattern is established in the codebase.
- Writing the commission **after** the source commits, in its own transaction, means a commission failure (e.g. unlinked seller, misconfigured rate) can never roll back revenue. This directly satisfies FR-012 (skip-and-log unlinked sellers).
- Registering observers in the provider (not via `#[ObservedBy]` on the models) keeps the Phase 1/2 model files unchanged.

**Alternatives rejected**:
- *Inline call inside `CreateSubscription`/`CreateSaleAction`*: couples P3 logic into P1/P2 files and shares their transaction — a commission bug could roll back a sale. Violates separation and the cross-phase "no forward dependency" intent.
- *Queued listener / job*: adds async complexity for a sub-millisecond arithmetic write. YAGNI (Principle VII). Backfill already covers any miss, and `afterCommit` is synchronous-but-safe.
- *Database trigger*: opaque, untestable in Pest, violates Laravel-first.

---

## D2. Commission rate resolution & base

**Decision** (from clarification "Employee rate, plan override"):
- Rate = `source-level rate ?? employee.commission_rate`.
- Source-level override exists for **subscriptions only**, via a new nullable `plans.commission_rate`. **Sales** use the employee rate.
- Base = subscription `price_paid` (post-discount realized) / sale `total`.
- `amount = bcmul(base, rate, 2)` via `bcmath` (consistent with Phase 1/2 money handling).

**Rationale**: A subscription maps to exactly one plan, so a plan-level override is unambiguous and useful (premium plans can pay higher commission). A sale spans multiple products at potentially different rates, so a single per-sale override is ambiguous; the clarification chose *plan* override, not product. Using realized amounts (`price_paid`, `total`) ties commission to actual revenue, which reconciles with the paid-payments revenue source (D5).

**Alternatives rejected**:
- *Product-level override on sales*: ambiguous aggregation across a multi-line sale; explicitly out of scope per clarification.
- *Commission on plan list price (not `price_paid`)*: would over-pay commission on discounted sales and break reconciliation.

---

## D3. Eligibility & the `employees.user_id` link

**Decision**: A commission is created only when the source's `sold_by_user_id` resolves to an `employees` row (via unique `employees.user_id`) **and** the resolved rate is non-zero (role `captain` carries a rate by default; `manager`/`employee` without a rate earn none). Unlinked sellers → no commission, logged at `info` for observability.

**Rationale**: Honors the integration contract (`sold_by_user_id` → `users`; P3 links via `employees.user_id`). The unique constraint guarantees a deterministic one-employee resolution. Skip-and-log (not error) keeps revenue flows resilient (FR-012).

---

## D4. Idempotency (live + backfill)

**Decision**: Unique index `commissions(source_type, source_id)`. Both the observer path and `commissions:backfill` use `firstOrCreate` keyed on the morph pair.

**Rationale**: Guarantees exactly one commission per source regardless of how many times either path runs (FR-011). Makes backfill safe to re-run and safe to run *after* the live trigger is active. DB-level uniqueness is the source of truth, not application bookkeeping.

**Alternatives rejected**: a `commissioned_at` flag on subscriptions/sales — mutates Phase 1/2 tables and is racier than a unique constraint.

---

## D5. Revenue source for financial reports

**Decision**: Revenue = `SUM(payments.amount) WHERE payments.status = 'paid'`, grouped by `DATE(paid_at)` / `YYYY-MM`, across both `payable_type` values. Expenses = `SUM(expenses.amount)` by `date` (includes payroll payouts written on pay). Net = revenue − expenses, computed per period bucket.

**Rationale**: The phase mandates revenue ties to **paid** payments only (not dues/partials). `payments` is the single polymorphic revenue source for subscriptions and sales (Phase 1 contract) — no forking. Grouping on `paid_at` reflects when cash was realized.

**Alternatives rejected**:
- *Revenue from `subscriptions.price_paid` + `sales.total`*: double-counts vs. payments, ignores partial/due states, and diverges from the canonical payments ledger.
- *Including partial/due amounts*: violates the explicit "paid only" reconciliation rule.

---

## D6. Report query strategy & indexing

**Decision**: All reports use **JOINs + aggregate `selectRaw`** (mirroring Phase 2 `PeriodSalesReport`), never correlated subqueries. New composite indexes:
- `commissions(employee_id, month, status)` — payroll sum + leaderboard + per-employee commission list.
- `payments(status, paid_at)` — revenue read path; **and** `payments(payable_type, payable_id, status)` — per-source lookups (phase-mandated).
- `sales(sold_by_user_id, created_at)` — per-employee performance (filter by seller, range by date).
- `subscriptions(sold_by_user_id)` — per-employee performance + backfill scan.
- `expenses(date)`, `expenses(category)` — report grouping + filters.

Already present (no migration): `subscriptions(status, end_date)`, `sales(status, created_at)`, `payments(status, created_at)` + morphs index.

**Rationale**: Phase 3 carries the heaviest queries; the phase explicitly calls for JOINs-over-subqueries and these exact composite indexes. Leading column ordering favors the actual `WHERE` predicate (e.g. `sold_by_user_id` before `created_at`).

> Note: the phase text lists `sales(created_at, sold_by_user_id)`; we invert to `(sold_by_user_id, created_at)` because the performance query filters by seller first then ranges by date — the more selective leading column. Documented deviation, reviewer-approved rationale.

**Alternatives rejected**: correlated subqueries (CPU killer at scale — explicit phase prohibition); PHP-side aggregation of large result sets (memory + N+1).

---

## D7. Pagination for large report/list endpoints

**Decision**: **Cursor (keyset) pagination** for unbounded lists (commissions, expenses, period reports), consistent with Phase 2's `cursorPaginate(50)`. Bounded aggregates (financial summary grouped by month over a range, dashboard) return the full small set.

**Rationale**: Phase mandates keyset over large `OFFSET`. Grouped financial summaries are inherently small (≤ a few dozen buckets) and don't need cursoring.

---

## D8. Payroll generation & "mark paid → expense"

**Decision**:
- `GeneratePayroll(month)`: for each **active** employee, `commissions_total = SUM(commissions.amount WHERE employee+month)`, `net = base + commissions_total + bonuses − deductions`, `firstOrCreate` on unique `(employee_id, month)` (no duplicates on re-run, FR-015).
- `UpdatePayroll`: adjust bonuses/deductions before paid; recompute net; reject if net < 0 (FR-017).
- `MarkPayrollPaid`: one `DB::transaction` → set `status=paid`, `paid_at=now()`; mark the month's commissions `paid`; create an `Expense` (`category='payroll'`, `amount=net`, `date=today`) as the payout record (FR-018).

**Rationale**: Single mechanism converts staff cost into an expense so the financial report's expense total always includes paid salaries (SC-009) with no double counting (only the expense row is summed; the commission rows are not expenses). Atomicity prevents partial payroll state.

**Alternatives rejected**: a separate payout ledger table — YAGNI; `expenses` is the payout record per the phase ("marking paid writes an expense").

---

## D9. Dashboard summary caching

**Decision**: Single `/dashboard/summary` endpoint backed by `DashboardSummary` action, cached in the Redis store under a versioned key (`dashboard:summary:v1`) with a short TTL (~60s). Explicit `Cache::forget` on new commission/sale/payment writes (in the observers and `MarkPayrollPaid`), so the leaderboard/revenue reflect changes promptly.

**Rationale**: Hot read path with several aggregates (Principle VI). Short TTL bounds staleness even if an invalidation is missed; explicit forget keeps it fresh. In tests the cache store is `array`, so behavior is deterministic.

**Alternatives rejected**: no caching (recomputes 6 aggregates per dashboard hit); long TTL without invalidation (stale leaderboard).

---

## D10. `month` representation

**Decision**: Store `month` as `char(7)` `YYYY-MM` on both `commissions` and `payroll`.

**Rationale**: Human-readable, lexicographically sortable, trivially indexable and groupable, and matches the `?month=` query contract directly without date math. Derived from source `created_at` for commissions and the target month for payroll.

**Alternatives rejected**: a `date` pinned to the 1st (needs formatting on every read); separate `year`+`month` ints (more columns, clumsier grouping).

---

## D11. Permissions & roles

**Decision**: New `HrFinancePermissions` support class: `employees.{view,create,update,delete}`, `commissions.{view,backfill}`, `payroll.{view,generate,pay}`, `expenses.{view,create,update,delete}`. **Reuse** existing `reports.view` (defined in `PosPermissions`) for financial/employee reports and dashboard summary. `HrFinanceAccessSeeder` assigns: Admin & Manager → all; Accountant → `reports.view`, `expenses.*`, `payroll.view`, `commissions.view`; (Captain/Cashier → none of HR by default). Final matrix polish deferred to Phase 4.

**Rationale**: Mirrors the established `PosPermissions` + `PosAccessSeeder` pattern (idempotent `firstOrCreate`). Reusing `reports.view` avoids permission sprawl (YAGNI) while the phase's `reports.*` intent is satisfied.

---

## D12. Audit logging

**Decision**: `LogsActivity` (Spatie, already installed) on `Employee`, `Commission`, `Payroll`, `Expense` with `logFillable()->logOnlyDirty()` and a per-model log name — identical to the Phase 1/2 models. `MarkPayrollPaid` additionally logs a business event.

**Rationale**: Consistent with every existing domain model; satisfies the phase's audit requirement (FR-031) with zero new infrastructure.
