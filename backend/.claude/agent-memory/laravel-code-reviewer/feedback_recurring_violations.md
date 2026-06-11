---
name: feedback-recurring-violations
description: Anti-patterns flagged in the Phase 3 (004-employees-payroll-reports) code review — check these first in future reviews
metadata:
  type: feedback
---

Recurring issues found in Phase 3; verify they have not recurred or regressed before approving future phases.

**Why:** these slipped past prior specialized reviews (security/perf/api all PASS-with-concerns) and into a "final" review, so they are easy to miss.

**How to apply — when reviewing new HR/Finance or similar feature code, specifically check:**
- **Data access inside Resources.** `PayslipResource::toArray()` ran an Eloquent query. Resources must only read already-resolved data. Grep new `*Resource.php` for `::where(`, `::find`, `::query(`, model facade calls.
- **PHPUnit-style new tests.** Two `tests/Unit/Actions/**` files used `extends TestCase` instead of Pest. The feature tests were correct Pest — the unit tests were the outliers. Always grep new test files for `extends TestCase` / `function test_`.
- **Synchronous unbounded backfill via HTTP.** `CommissionController::backfill` runs the whole historical scan inline with `from`/`to` only `nullable`. The performance review marked this blocking (B1) and it was NOT remediated even though the suite was green and other B-findings were fixed. A green suite + prior "PASS with concerns" does NOT mean blocking findings were closed — re-verify each prior blocking finding against current code.
- **FQCN leaked as polymorphic `source_type`.** Commissions store `get_class($source)` and the Resource exposes it; no morph map is enforced. Recommend `Relation::enforceMorphMap`.

**Phase 4 (005-permissions-audit-branding) additions — verify these do not recur:**
- **Inline `if (!$user->can()) return 403` in controllers.** `ExportController::export` (resource permission) and `PaymentController::store` (subscription ownership) hand-roll authz in the controller body instead of a Form Request `authorize()` / Policy / `can` middleware. Constitution §II forbids this. Grep new controllers for `->can(` and `status: 403`.
- **`activity()->causedBy(int)`.** `GenerateExportJob` passes `$this->userId` (int) to `causedBy()`, which expects a Model — causer is silently dropped, so queued exports log with a null causer (audit gap). Pass a resolved `User::find($id)` or serialize the User.
- **Resource leaking raw `properties`.** `AuditLogResource` returns `$this->properties` verbatim — if any future logged model stores secrets/PII in activity properties it leaks. Acceptable now (no sensitive subjects logged) but flag if payment/auth events get activity logging.

**General lesson:** prior review artifacts in `specs/*/reviews/` may say PASS/remediated, but blocking findings can remain open. Read each prior review's blocking section and confirm remediation in the actual code, not the verdict line. See [[project-constitution-gates]].
