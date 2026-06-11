# Members, Subscriptions & Plans — Performance Review (T107)

**Reviewer:** laravel-performance-reviewer
**Date:** 2026-06-11
**Scope:** Members, plans, subscriptions, payments, reminders, notifications, dashboard.
**Reference:** `.specify/memory/constitution.md` Principle VI (Performance-Focused Data Access).

## Verdict: PASS

No blocking N+1, indexing, or “heavy work inline” defects remain in the shipped Phase 1 scope. Collections are paginated, list endpoints eager-load the relations they render, reminder delivery is queued and selected in chunks, member payment totals are aggregated in SQL, payment recording uses SQL `SUM()`, and the key foreign-key / filter columns are indexed in the migrations.

---

## Medium

None.

## Low

None.

## Verified-Good

- **Pagination:** member, plan, subscription, payment, notification, member-payment, and dashboard expiring-soon list endpoints paginate rather than returning unbounded collections.
- **Eager loading:** subscriptions and dues views load the related member/plan/soldBy data they expose; member photo streaming is single-record I/O, not list-based.
- **Indexes:** migrations added indexes for foreign keys and hot query columns, including `status`, `end_date`, morph keys, member search/default ordering, payment status/latest access, and notification unread/latest access.
- **Queued work:** renewal reminders are dispatched through `SendRenewalReminderJob`; selection is chunked to avoid loading the full reminder set into memory; expiration and reminder scans are scheduled commands rather than request-path work.
- **Money math:** payment balance calculations use `bcmath`, avoiding floating-point drift on partial-payment flows.
- **Dues query:** dues use one grouped payment aggregate subquery instead of duplicate correlated sums.
- **N+1 posture:** no obvious query-in-loop defects surfaced in the current resources/controllers under test coverage.

## Summary

Performance is in a good place for this phase. The prior dashboard, reminder-selection, payment-recording, and dues-aggregation issues were fixed. Everything is shaped sensibly for the current backend slice.
