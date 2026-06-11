---
name: phase3-audit
description: Phase 3 (004-employees-payroll-reports) release-readiness audit findings — what passed, what blocked, remediation state
metadata:
  type: project
---

Phase 3 HR/Finance audit (release-readiness gate, 2026-06-11). Branch `004-employees-payroll-reports`.

**State at audit:** Suite 360 passed / 1383 assertions (herd-lite 8.4); Pint clean. Most prior-review blockers were remediated in code AFTER the review docs were written — always re-verify code, do not trust the prior-review verdicts in `reviews/*.md` at face value:
- DB B-1 (`add_seller_indexes` `down()` MySQL dup-key crash) — FIXED: `down()` now drops only `(sold_by_user_id, created_at)` on sales and `(sold_by_user_id)` on subscriptions; leaves FK-backing indexes.
- DB H-1 — FIXED: `add_revenue_indexes` `down()` uses explicit index-name strings.
- Perf B2 (per-row `exists()` N+1 in backfill) — FIXED: per-chunk `whereIn(...)->pluck()->flip()` diff.
- Perf N1 — FIXED: backfill pre-maps `Employee::whereNotNull('user_id')->keyBy('user_id')`.
- Sec M1 — FIXED: `BackfillCommissionsRequest` now fronts the endpoint (validates from/to/dry_run).
- API-contract 3 required doc changes — DONE in `contracts/api.md` (offset pagination baseline line 5; `start_date`/`end_date` expense filters; payroll/generate 200-only).

**FINAL VERDICT: PASS (2026-06-11, second audit).** All 8 gates PASS. The prior FAIL (DoD-closure: no `reviews/code-review.md`, unchecked gate tasks T002/T085-T091) is resolved — `code-review.md` now exists (carries an old FAIL verdict but its 2 Criticals are code-remediated; re-verify code not the doc) and gate tasks are checked. NOTE: implementation tasks T001/T003-T084 are now `[ ]` (mass checkbox lag — code+tests verifiably exist, suite green); only review/record/gate tasks are checked. This inverts the prior snapshot — do not read the unchecked impl boxes as missing work.

**Perf B1 (synchronous backfill) — NOW CODE-FIXED, not just accepted (changed since first audit).** `BackfillCommissionsRequest::prepareForValidation` defaults `from`/`to` to last-90-days when absent (no full-table scan on empty body) and `rules()` enforces a 366-day max span via a closure; docblock matches the enforced rules. The unbounded HTTP path is closed. CLI still available for larger runs.

**Code-review 4 required actions — 3 of 4 closed, verified in tree:** (1) PHPUnit→Pest rewrite of the 2 unit files DONE; (2) backfill bounding DONE (above); (3) PayslipResource query moved to controller (`setRelation('monthCommissions')`) DONE. (4) Morph-map FQCN leakage STILL OPEN — `CalculateCommission` persists `source_type = get_class($source)`, `CommissionResource` emits the raw `App\Models\*` FQCN, NO `morphMap` in `app/`, and tests hardcode `Subscription::class`/`Sale::class`. Classified Major (not merge-blocking by the code-review gate), so carried as a non-blocking follow-up, NOT a release blocker. Recommend morph map alias in a fast-follow before external clients depend on `source.type`.

**The blocking issue at audit was DoD-record completeness, not code.** Per [[feedback-recurring-gaps]], unchecked record tasks in tasks.md block a formal PASS even when the underlying condition is verified true. At audit these were `[ ]`:
- T002 architecture review record (yet `reviews/architecture.md` exists & is APPROVED — checkbox lag)
- T085 US7 focused-test record
- T086 docs-sync record
- T087 Pint-formatting record (Pint verified clean live)
- T091 final code-review + release-readiness gate; also no `reviews/code-review.md` exists, and its note says "358 passed" (stale; now 360)

**Cosmetic doc gap (non-blocking):** `contracts/api.md` line 15 still shows `meta.next_cursor` for `GET /employees`, but that endpoint uses offset pagination per the corrected line 5. Same `GET /employees` body. Harmless inconsistency.

**Good patterns confirmed this phase:** `MarkPayrollPaid` reconciles drift correctly — re-sums pending commissions under `lockForUpdate()` inside `DB::transaction`, recomputes net, bulk-flips exactly the settled commissions, writes payroll expense, forgets dashboard cache. Live commission trigger via observers + `DB::afterCommit` (no Phase 1/2 Action edits). All 4 new models explicit `$fillable`, no `$guarded=[]`. Reports use JOIN/derived-table aggregates, no correlated subqueries.
