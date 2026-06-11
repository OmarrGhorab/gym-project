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

**General lesson:** prior review artifacts in `specs/*/reviews/` may say PASS/remediated, but blocking findings can remain open. Read each prior review's blocking section and confirm remediation in the actual code, not the verdict line. See [[project-constitution-gates]].
