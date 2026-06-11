---
name: feedback-recurring-findings
description: Architecture findings this reviewer raises repeatedly on this project — check for them proactively in every review
metadata:
  type: feedback
---

Recurring issues to look for proactively (raised in the Phase 1 architecture review, 2026-06-10):

- **UserResource N+1 when embedded in collections.** `UserResource::toArray` uses Spatie `getRoleNames()`/`getAllPermissions()`, which lazy-load per model. Eager-loading `roles`+`permissions` alone does NOT reliably fix it (getAllPermissions merges role-derived perms). Prefer a slim embed resource (id+name) for list rendering; reserve the full UserResource for the authenticated-self endpoint. Always demand an N+1 assertion test. See [[project-phase0-conventions]].

- **Derive-under-lock for any read-sum-then-write.** Whenever balance/cap is derived (`price_paid − SUM(payments)`, `SUM(freezes.days) <= max_freeze_days`) and then a row is inserted + parent mutated, a concurrent request races past the guard. Require a DB transaction + `lockForUpdate()` on the parent (subscription) row, plus a concurrency test. The derived-balance pattern itself is correct and YAGNI-right; only the concurrency window is the hole.

- **"Status of a payment row" ≠ "subscription owes money."** A `partial` payment leaves a balance but produces no `due`-status row, so filtering `payments.status='due'` misses it. Dues lists should be subscription-balance-centric (`withSum` + `having balance > 0`), not payment-status-centric. Pin this in the contract before coding.

- **Durable idempotency, not cache keys.** For scheduled "once per window" guarantees (reminders), reject cache-key idempotency (non-durable; array cache in tests). Require a queryable/indexed column (e.g. `last_reminded_on` date on the subject row).

- **Member/profile aggregates must use `withSum`/`withCount`, never per-row loops.** Spec repeatedly demands "summary without N+1"; the implementer's natural instinct (loop subscriptions, sum each) is the defect.

**Why:** These are the highest-probability "looks done but wrong/slow" defects on this codebase given its derived-balance + polymorphic-payments + scheduled-automation design.
**How to apply:** Scan every subscription/payment/notification design for these four shapes before approving.
