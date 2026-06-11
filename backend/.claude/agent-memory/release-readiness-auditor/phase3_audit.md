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

**Perf B1 (synchronous unbounded backfill in HTTP request) — ACCEPTED, not code-fixed.** `CommissionController::backfill` still calls `executeBackfill()` inline; `BackfillCommissionsRequest` leaves `from`/`to` nullable (no bound enforced). T089 in tasks.md records this as a conscious documented decision: CLI (`commissions:backfill`) is the safe path for large historical runs; HTTP path accepted as a scale-risk. This satisfies the perf reviewer's stated minimum bar ("conscious, documented decision"). Not a release blocker — but if a future phase or prod incident hits a timeout, queue it (`ShouldQueue` + 202) or require a bounded window.

**The blocking issue at audit was DoD-record completeness, not code.** Per [[feedback-recurring-gaps]], unchecked record tasks in tasks.md block a formal PASS even when the underlying condition is verified true. At audit these were `[ ]`:
- T002 architecture review record (yet `reviews/architecture.md` exists & is APPROVED — checkbox lag)
- T085 US7 focused-test record
- T086 docs-sync record
- T087 Pint-formatting record (Pint verified clean live)
- T091 final code-review + release-readiness gate; also no `reviews/code-review.md` exists, and its note says "358 passed" (stale; now 360)

**Cosmetic doc gap (non-blocking):** `contracts/api.md` line 15 still shows `meta.next_cursor` for `GET /employees`, but that endpoint uses offset pagination per the corrected line 5. Same `GET /employees` body. Harmless inconsistency.

**Good patterns confirmed this phase:** `MarkPayrollPaid` reconciles drift correctly — re-sums pending commissions under `lockForUpdate()` inside `DB::transaction`, recomputes net, bulk-flips exactly the settled commissions, writes payroll expense, forgets dashboard cache. Live commission trigger via observers + `DB::afterCommit` (no Phase 1/2 Action edits). All 4 new models explicit `$fillable`, no `$guarded=[]`. Reports use JOIN/derived-table aggregates, no correlated subqueries.
