# Code Review: Phase 3 — Employees, Payroll, Commissions & Reports

**Branch:** `004-employees-payroll-reports`
**Scope:** All files changed/created vs `main` (Phase 3 HR & Finance modules).
**Standard:** `.specify/memory/constitution.md` v1.0.0 (authoritative) + Laravel 12 / PHP 8.4 best practices.
**Reviewer:** laravel-code-reviewer (final pre-merge gate)
**Date:** 2026-06-11
**Test suite at review time:** 360 passed, 0 failures.

---

## Verdict: FAIL (REJECTED)

The phase is, on the whole, well-engineered: thin controllers delegating to single-purpose Actions, explicit `$fillable` allowlists, `$hidden` on credentials, Policies enforcing every endpoint, Form Requests carrying validation + authorization, correct money handling via `bcmath`, reversible migrations with deliberate FK `on delete` behavior, and the `MarkPayrollPaid` reconciliation is genuinely careful (single locked query, no N+1, correct race handling). However, two NON-NEGOTIABLE Constitution gates are violated in code that is part of this branch: (1) PHPUnit-style test classes were introduced for new tests (Principle III, explicit blocking gate), and (2) the prior performance review's **blocking** finding B1 — the synchronous, unbounded `commissions:backfill` HTTP endpoint — has **not** been remediated (Principle VI, "queue heavy work"; "never return unbounded result sets"). Per the Constitution's Code Review Quality Gates, either of these blocks merge. The verdict is REJECTED until both are resolved.

## Summary

Reviewed all Phase 3 controllers, Actions, Form Requests, Models, Policies, Resources, Observers, the backfill command, migrations, routes, and tests. Layering, security-by-default, and money/precision handling are strong and consistent with prior PASS reviews. The blockers are a test-framework violation and an unremediated blocking performance finding carried over from the performance review. A small number of Major/Minor items (data-access logic inside a Resource, model class name leaked through the API contract) should also be addressed.

---

## Findings

### Critical

- **[tests/Unit/Actions/Payroll/PayrollActionsTest.php:15] and [tests/Unit/Actions/Commissions/CalculateCommissionTest.php:14] — PHPUnit-style test classes introduced for new tests.**
  Both files are written as `class …Test extends Tests\TestCase` with `public function test_*(): void` methods and `RefreshDatabase`, not Pest. Constitution Principle III states plainly: *"Pest is the testing framework; PHPUnit-style classes MUST NOT be introduced for new tests,"* and the Code Review Quality Gates list this as a blocking condition. Every other new test in the branch (e.g. `tests/Feature/Api/V1/Payroll/PayrollCommissionReconciliationTest.php`, `tests/Unit/Actions/Reports/FinancialReconciliationTest.php`) is correctly written in Pest `it()/test()` style — these two are the outliers. **Why it matters:** the Constitution is authoritative and names this exact pattern as forbidden and merge-blocking; allowing it normalizes drift away from the mandated framework. **Required fix:** rewrite both files in Pest function style (`it('…', function () { … })->`), using `uses(RefreshDatabase::class)` and `beforeEach()` as the surrounding feature/unit tests already do. Keep the assertions identical so coverage is unchanged.

- **[app/Http/Controllers/Api/V1/CommissionController.php:49-64] + [app/Http/Requests/Commissions/BackfillCommissionsRequest.php:21-27] — Unbounded historical backfill runs synchronously in the HTTP request (perf review B1, unremediated).**
  `backfill()` instantiates `BackfillCommissionsCommand` and calls `executeBackfill()` inline in the request lifecycle. `BackfillCommissionsRequest` declares `from`/`to` as `nullable` with no required range and no span cap, so an authorized `POST /api/v1/commissions/backfill` with an empty body chunks **every** historical subscription and sale for all linked sellers synchronously — thousands of queries in one web request, certain to hit FPM/proxy/`max_execution_time` limits and hold a worker hostage. This is the textbook "queue heavy work / heavy aggregation" case in Principle VI and the "never return unbounded result sets" gate. The performance review (`reviews/performance.md` §B1, "Summary of Required Actions" #1) marked this **blocking**; it remains open. Note the FormRequest docblock claims it bounds the window, but the rules do not enforce that — the comment and the code disagree. **Why it matters:** a single authorized call can take down a web worker; the Constitution bans synchronous heavy work and the prior blocking finding was not closed. **Required fix (pick one):** (a) dispatch the backfill as a `ShouldQueue` job and return `202 Accepted` — the existing `chunkById` makes it queue-ready; or (b) make `from`/`to` **required** with an enforced maximum span, and document full-history backfill as CLI-only (`php artisan commissions:backfill`). The unbounded full-history path must not be reachable from a web request.

### Major

- **[app/Http/Resources/PayslipResource.php:17-19] — Data access / business logic inside an API Resource.**
  `toArray()` runs `Commission::where('employee_id', …)->where('month', …)->get()` directly inside the Resource. Constitution Principle II restricts Resources to response shaping only ("Response shaping MUST go through API Resources" — they are the *output* layer, not a data-access layer). This also defeats eager-loading: the query is hidden from the controller/Action and runs on every payslip render. It is one extra query for a single-model endpoint (not an N+1 loop), so it is not a Critical perf defect, but it is logic in the wrong layer. **Required fix:** load the commissions in `PayrollController::payslip()` (or a small Action) and pass them to the Resource via the model relation / a computed property, e.g. `$payroll->setRelation('monthCommissions', …)` then `whenLoaded`, or resolve them in `GeneratePayslip`. The Resource should only read already-resolved data.

- **[app/Http/Resources/CommissionResource.php:18-21] + [app/Actions/Commissions/CalculateCommission.php:70-72] — Fully-qualified model class name persisted and leaked through the API contract.**
  Commissions store `source_type = get_class($source)` (e.g. `App\Models\Subscription`) and `CommissionResource` exposes it verbatim as `source.type`. No morph map is enforced (`Relation::enforceMorphMap` / `morphMap`), so (a) internal namespace/class names leak to API clients, and (b) renaming or relocating `Subscription`/`Sale` silently breaks all stored polymorphic rows. The documented contract (`contracts/api.md`) lists `source: { type, id }` without committing to FQCNs, so a stable alias is contract-compatible. **Why it matters:** leaking internals is a minor data-exposure / contract-stability concern and a maintenance landmine for future refactors. **Required fix:** register a morph map (e.g. `'subscription' => Subscription::class`, `'sale' => Sale::class`) in a service provider so stored `source_type` becomes a stable alias, and let the Resource emit that alias. Add a data migration note if any rows already exist.

### Minor

- **[app/Actions/Reports/DashboardSummary.php:81-91] — Captain leaderboard filters `commissions.month` alone.** The composite index is `commissions(employee_id, month, status)`; a `WHERE month = ?` predicate without a leading `employee_id` cannot use it efficiently. Low impact today (current-month bucket is small), but consider a standalone index on `month` if the leaderboard grows, or document the acceptance. (Consistent with perf review's index tail notes.)

- **[app/Http/Controllers/Api/V1/DashboardController.php:13] — `DashboardController` is not declared `final`.** Every other Phase 3 controller (`Employee`, `Commission`, `Payroll`, `Expense`, `Report`) is `final class`. Minor consistency nit; `summary()` is the Phase 3 addition here.

- **[app/Console/Commands/BackfillCommissionsCommand.php:79,115] — Expression-statement ternary used for a side effect.** `$employee && bccomp(...) > 0 ? null : $skippedUnlinked++;` is hard to read and discards its value. Prefer an explicit `if (! ($employee && bccomp(...) > 0)) { $skippedUnlinked++; }`. Readability only.

- **[app/Http/Controllers/Api/V1/CommissionController.php:16,71 (Payroll update/pay), :104] — Untyped route-id parameters (`$employeeId`, `$id`).** Several signatures take a bare `$id`/`$employeeId` then `findOrFail`. Route-model binding (as used in Employee/Expense controllers) would be more consistent and self-documenting. Functional as-is; consistency nit.

### Suggestions

- Consider enabling `Model::preventLazyLoading()` in non-production (Principle VI "N+1 detection SHOULD be enabled in development") — it is not currently set anywhere, which is how the PayslipResource query above slips through unnoticed.
- `EmployeeController::index` uses `paginate(15)` with a hardcoded page size across all list endpoints. Fine per spec, but a shared constant or config would centralize the convention.
- The reports endpoints (`ReportController::financial`, `::employees`, `EmployeeController::performance`) return ad-hoc aggregate arrays rather than API Resources. This is acceptable for non-model analytic payloads and matches the documented contract, but if these shapes start being reused, promote them to dedicated Resources for single-source-of-truth shaping.

---

## Constitution Compliance

| Principle | Status | Notes |
|---|---|---|
| I — Laravel-First | PASS | Native Eloquent, Form Requests, Policies, Resources, observers, queue-ready chunking. `spatie/query-builder` used for filtering (justified, installed in Phase 0). No needless abstraction. |
| II — Thin Transport / Separated Logic | **FAIL** | Controllers are thin and delegate to Actions correctly — but `PayslipResource` performs data access inside a Resource (Major). |
| III — Test-First with Pest | **FAIL** | Two new unit test files are PHPUnit-style classes (Critical) — explicit blocking gate. |
| IV — Versioned, Consistent Contract | PASS (minor) | All routes under `/api/v1`; `{data,meta,message}` envelope used throughout; correct status codes (201/204/409/422). Model FQCN leaked as `source.type` is a contract-cleanliness concern (Major). |
| V — Security by Default | PASS | Explicit `$fillable` on all four models; `$hidden` on `User`; every endpoint authenticated (`auth:sanctum` group in `routes/api.php`) AND policy/permission-gated; no raw concatenated SQL (parameterized `selectRaw` group expressions are constant-driven, sqlite/mysql branches are literals, not user input); write/sensitive routes rate-limited (`throttle:sensitive` on backfill/generate/pay, `throttle:api` on writes). |
| VI — Performance-Focused Data Access | **FAIL** | Indexes present and correct; reports use JOIN+aggregate; pagination everywhere; dashboard cached with explicit invalidation; `MarkPayrollPaid` is single-query. BUT the unbounded synchronous HTTP backfill (B1) is unremediated (Critical). |
| VII — Simplicity / YAGNI | PASS | No repository pattern, no speculative interfaces, Actions are single-purpose. |

Migrations: reversible `down()` on all; FKs declare `on delete` deliberately (`nullOnDelete` for `user_id`/`created_by`, `restrictOnDelete` for `employee_id` to protect financial history); plural snake_case tables, `*_id` FKs, timestamped files. Compliant.

---

## Required Actions Before Merge

1. **(Critical — Principle III)** Rewrite `tests/Unit/Actions/Payroll/PayrollActionsTest.php` and `tests/Unit/Actions/Commissions/CalculateCommissionTest.php` in Pest function style (no `extends TestCase` classes). Keep assertions identical; confirm suite stays green.
2. **(Critical — Principle VI / perf B1)** Queue the `commissions:backfill` HTTP endpoint (`ShouldQueue` + `202 Accepted`), OR make `from`/`to` required with an enforced max span and restrict full-history backfill to the CLI. Align the `BackfillCommissionsRequest` docblock with whatever rule is actually enforced.
3. **(Major — Principle II)** Move the commission lookup out of `PayslipResource::toArray()`; resolve it in the controller/Action and pass it in via a relation/property.
4. **(Major — Principle IV)** Introduce a morph map so `commissions.source_type` is stored/exposed as a stable alias rather than the FQCN; stop leaking `App\Models\…` through `CommissionResource`.

Re-run the full Pest suite after items 1–4; it must remain green. Once the two Critical items are closed, this can be re-reviewed for an APPROVED verdict (items 3–4 are strongly recommended in the same pass).
