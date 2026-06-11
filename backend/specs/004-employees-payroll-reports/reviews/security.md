# Phase 3 Security Review — Employees, Payroll, Commissions & Reports

**Branch:** `004-employees-payroll-reports`
**Scope:** `git diff fef5e76..HEAD` (commits `7d34163`, `7f7890a`, `82b8174`)
**Standard:** `.specify/memory/constitution.md` Principle V (Security by Default) + `CLAUDE.md`
**Reviewer:** laravel-security-reviewer
**Date:** 2026-06-11

## Verdict: PASS

No Critical or High Risk issues. All Phase 3 endpoints are authenticated and permission-gated, all models use explicit `$fillable` allowlists, all server-controlled financial fields are set in code, and all dynamic SQL is parameter-bound or built from hardcoded (validated) tokens. A small set of non-blocking hardening notes follows.

---

## Critical Issues

None.

## High Risk Issues

None.

## Medium Risk Issues

### M1 — `commissions/backfill` accepts unvalidated `from`/`to`/`dry_run` (no Form Request)
**File:** `app/Http/Controllers/Api/V1/CommissionController.php:51-57`

`backfill()` reads `$request->input('from')`, `$request->input('to')`, `$request->input('dry_run', false)` with no validation and passes them straight to `BackfillCommissionsCommand::executeBackfill()`. These values reach `where('created_at', '>=', $from)` in `BackfillCommissionsCommand` — **bound parameters, so there is no SQL injection** — but a malformed or array value would surface as a 500 rather than a clean 422, and the date range is uncapped.

This is not exploitable for data exfiltration or injection (the route is gated by `permission:commissions.backfill` + `throttle:sensitive`, and the only callers with that permission are Admin/Manager). It is a robustness/input-hygiene gap, not a vulnerability.

**Fix:** Front the endpoint with a `BackfillCommissionsRequest` Form Request:
```php
public function rules(): array
{
    return [
        'from' => ['nullable', 'date_format:Y-m-d'],
        'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        'dry_run' => ['sometimes', 'boolean'],
    ];
}
```
Then type `dry_run` via `$request->boolean('dry_run')`.

### M2 — Private `local` disk still has `serve => true` (deferred from Phase 0)
**File:** `config/filesystems.php` (carried forward; re-checked this phase)

Phase 3 generates payslip PDFs (`GeneratePayslip` via DomPDF). Today these are streamed inline through an authorized controller action (`PayrollController::payslip`, gated by `permission:payroll.view` + `authorize('view', $payroll)`) and are **not persisted** to the `local` disk, so there is no current exposure. The Phase 0 deferred item remains: if any future code writes payslips/exports to `storage/app/private` and relies on the framework `storage:` serve route, confirm that route is auth+policy gated or set `serve => false` and stream via a gated controller. No action required for this phase.

### M3 — `EmployeeController::index` `q` filter on `like` over user input
**File:** `app/Http/Controllers/Api/V1/EmployeeController.php:23-30`

The `q` filter does `where('name', 'like', "%{$value}%")` with a bound value (safe from SQLi). `%`/`_` wildcards in the input are passed through, so a caller can broaden the LIKE — a minor information-shaping concern only, behind `permission:employees.view`. Optional: escape LIKE metacharacters. Non-blocking.

---

## Non-Blocking Hardening Notes

- **N1 — `PayslipResource` issues a query inside `toArray()`** (`PayslipResource.php:19-21`). Not a security issue, but resource methods doing DB work invites N+1 if ever collection-rendered. Flagged for the performance reviewer; mentioned here only because it sits on a financial read path.
- **N2 — `sensitive`/`api` limiters key on `user()->id ?: ip()`** (`AppServiceProvider.php`). Correct, since these run after `auth:sanctum`. Login still keys on IP only — the Phase 0 recommendation to use an email+IP composite key for `auth` stands (not Phase 3 code).
- **N3 — Payslip PDF filename** is `payslip-{$payroll->id}.pdf` using the integer PK (`GeneratePayslip.php`). No path traversal (no user-controlled string in the filename) and the value is server-derived. Good.

---

## Concern-by-Concern Findings (against the review brief)

1. **Mass-assignment protection — PASS.** `Employee`, `Commission`, `Payroll`, `Expense` (and `Plan`'s new `commission_rate`) all declare explicit `$fillable` allowlists; no `$guarded = []` anywhere. Server-controlled fields are set in code, not copied from raw request input:
   - `Expense.created_by` ← `$request->user()->id` (`ExpenseController::store:62`), never from the request body (not in `StoreExpenseRequest::rules`).
   - Commission `employee_id`, `rate`, `amount`, `month`, `status`, and `source_type`/`source_id` are all computed in `CalculateCommission::forSource` — never client-supplied.
   - Payroll `employee_id`, `base_salary`, `commissions_total`, `net_salary`, `status`, `paid_at` are all derived server-side in `GeneratePayroll`/`MarkPayrollPaid`/`UpdatePayroll`. The only client-writable payroll fields are `bonuses`/`deductions` via `UpdatePayrollRequest` (validated `numeric, min:0`), with `net_salary` recomputed and negative-guarded.
   - `StoreEmployee`/`UpdateEmployee` copy only whitelisted keys from `$request->validated()`.
2. **Access control — PASS.** Every Phase 3 route is inside the `auth:sanctum` group in `routes/api.php` and carries a `permission:*` middleware (`employees.*`, `commissions.*`, `payroll.*`, `expenses.*`, `reports.view`). Controllers additionally call Policy methods (`authorize('viewAny'|'view'|'pay'|'backfill', ...)`) and Form Requests gate via `$user->can(...)` — no hand-rolled permission logic. `CommissionController::index` authorizes **before** `findOrFail`, closing the existence-probe gap. Permissions are seeded with `guard_name => 'web'` (matching Sanctum) in `HrFinanceAccessSeeder`.
   - **Object-ownership note (by design, acceptable):** these are staff/back-office resources, not per-end-user data. Authorization is permission-based, not per-row ownership: any holder of `commissions.view` can read any employee's commissions, any holder of `payroll.view` can read any payslip. This matches the role matrix (Admin/Manager/Accountant) and the spec — there is no "an employee sees only their own payslip" requirement in Phase 3. No IDOR, because the resource class is uniformly gated. Recorded as the intended model, not a finding.
3. **Sensitive-field exposure — PASS.** `User::$hidden` = `password`, `remember_token`; password cast `hashed`. Resources expose only intended fields; the user object is rendered via `UserSummaryResource` (summary projection), never the raw model. No tokens, hashes, or internal-only columns leak. Activity-log sensitive-key blocklist remains in place (Phase 0).
4. **Query safety — PASS.** All Eloquent/query-builder `where`/`whereBetween`/`whereIn` use bound parameters. The `selectRaw`/`DB::raw` in `FinancialReport`, `DashboardSummary`, `EmployeePerformanceReport`, and `DashboardController` contain **no user input** — the only dynamic fragment is the date-grouping expression (`strftime`/`DATE_FORMAT`), chosen by a hardcoded branch on `$groupBy`, which `FinancialReportRequest` validates to `in:day,month`. `BackfillCommissionsCommand` date filters are bound parameters. No string concatenation of untrusted input into SQL.
5. **Throttling — PASS.** `throttle:sensitive` (10/min, keyed by user-id-or-IP) on `commissions/backfill`, `payroll/generate`, `payroll/{id}/pay`. `throttle:api` (60/min) on all employee/expense writes and `payroll/{id}` update. Limiter defs in `AppServiceProvider::configureRateLimiters`. Adequate for money-moving endpoints.
6. **Secrets & logging — PASS.** No secrets in Phase 3 code. Logging uses the framework `Log` facade only (`CalculateCommission`, `GeneratePayslip`); messages contain IDs/types, no credentials or PII (no salaries/amounts logged). No `dd`/`dump`/`var_dump`/`echo`.
7. **`employees.user_id` link validated — PASS.** `StoreEmployeeRequest`/`UpdateEmployeeRequest` require `user_id` to be `integer, exists:users,id` and `unique:employees,user_id` (the update rule ignores the current row). DB enforces a `unique` constraint and `nullOnDelete` FK. A request cannot point an employee at a non-existent user or hijack a user already attributed to another employee.

---

## Constitution Security Gate Checklist

| Gate (Principle V) | Status | Evidence |
|---|---|---|
| Explicit `$fillable` allowlist; no `$guarded = []` | PASS | Employee/Commission/Payroll/Expense/Plan |
| `$hidden` for sensitive fields | PASS | `User::$hidden`; resources project safe fields |
| Every non-public endpoint authenticated | PASS | All Phase 3 routes under `auth:sanctum` |
| Every non-public endpoint policy/permission-gated | PASS | `permission:*` middleware + Policy `authorize()` |
| No hand-rolled permission checks in controllers | PASS | Policies + `can()`/middleware only |
| Bindings only; no raw SQL with user input | PASS | `selectRaw` tokens hardcoded; `group_by` allowlisted |
| Rate-limit auth/sensitive/write endpoints | PASS | `throttle:sensitive` + `throttle:api` applied |
| Secrets via env only | PASS | No secrets introduced in Phase 3 |
| Structured logging, no secrets/PII | PASS | `Log` facade; IDs/types only |

## Required before merge

Nothing blocking. Recommended (non-blocking) follow-up: address **M1** by adding a `BackfillCommissionsRequest` so the backfill endpoint returns 422 on malformed `from`/`to` instead of 500 and bounds the range.
