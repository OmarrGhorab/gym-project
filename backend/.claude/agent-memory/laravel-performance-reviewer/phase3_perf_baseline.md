---
name: phase3-perf-baseline
description: Phase 3 (employees/payroll/commissions/reports) perf baseline — reports use JOIN+aggregate, indexes present, dashboard cached; backfill-in-request is the one concern
metadata:
  type: project
---

Phase 3 perf review (2026-06-11, verdict PASS WITH CONCERNS):

- **Reports (D6 compliant):** `FinancialReport` = 2 independent grouped aggregate queries merged in PHP. `EmployeePerformanceReport` uses `leftJoinSub` derived tables (NOT correlated subqueries). `DashboardSummary` = direct join+groupBy. None use correlated subqueries — do not flag these as N+1; they are single aggregate queries.
- **Indexes all present** (migrations `200000`-`200600`): `commissions(employee_id,month,status)` + unique `(source_type,source_id)`; `payments(status,paid_at)` + `(payable_type,payable_id,status)`; `sales(sold_by_user_id,created_at)`; `subscriptions(sold_by_user_id)` (no created_at tail — asymmetric vs sales, low pri); `expenses(date)`+`(category)`; `employees(user_id)` unique; `payroll(employee_id,month)` unique + `(month,status)`.
- **Known index soft-spots (acceptable, bounded+cached):** leaderboard `WHERE commissions.month=?` can't seek (month is col 2 of composite); `subscriptions` perf-report `created_at` range not in a composite. Both bounded; dashboard cached 60s.
- **Dashboard cache (D9):** `Cache::remember('dashboard:summary:v1', 60, ...)`; invalidated via `Cache::forget` in SaleObserver/SubscriptionObserver (created/updated/deleted) and MarkPayrollPaid. Correct.
- **MarkPayrollPaid reconciliation (the recent lockForUpdate fix): CORRECT, not an N+1.** One locked SELECT of pending commissions, in-memory bcadd reduce (zero queries in loop), single bulk update flip. Lock scoped to indexed (employee_id,month,status) range. Do not re-flag.
- **THE concern — backfill in request path:** `CommissionController::backfill` runs `BackfillCommissionsCommand::executeBackfill` SYNCHRONOUSLY in HTTP. Unbounded historical scan over all sales+subs, plus per-row `Commission::...->exists()` N+1 (redundant — firstOrCreate already idempotent via unique index). Recommended: queue it or require bounded from/to; replace per-row exists() with per-chunk whereIn pluck diff. CLI path (`commissions:backfill`) is the safe entry.
- **All live Resource paths eager-load correctly** (EmployeeController/PayrollController/ExpenseController) — no live N+1. PayslipResource self-queries commissions but is single-payslip only (latent 1+N if ever listed). Related: [[userresource-spatie-lazyload]], [[phase0-perf-baseline]].
