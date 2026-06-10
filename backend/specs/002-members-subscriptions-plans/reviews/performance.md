# Members, Subscriptions & Plans — Performance Review (T107)

**Reviewer:** laravel-performance-reviewer
**Date:** 2026-06-10
**Scope:** Members, plans, subscriptions, payments, reminders, notifications, dashboard.
**Reference:** `.specify/memory/constitution.md` Principle VI (Performance-Focused Data Access).

## Verdict: PASS

No blocking N+1, indexing, or “heavy work inline” defects were found in the shipped Phase 1 scope. Collections are paginated, list endpoints eager-load the relations they render, reminder delivery is queued, and the key foreign-key / filter columns are indexed in the migrations. There is one Medium recommendation around the dashboard’s current expiring-soon implementation.

---

## Medium

### M1 — Dashboard expiring-soon materializes a collection instead of paginating a query
**Files:** `app/Http/Controllers/Api/V1/DashboardController.php`, `app/Actions/Reminders/FindExpiringSubscriptions.php`

**Finding:** `expiringSoon()` calls the reminder finder, which executes `->get()`, then sorts the in-memory collection and returns a synthetic single-page pagination envelope.

**Impact:** Fine at current scale, but it will not age well if the gym accumulates a large number of expiring subscriptions. It also prevents true `?page=` behavior.

**Recommendation:** Refactor the finder into a query builder or dedicated dashboard query so this endpoint can paginate in SQL and avoid loading all candidates into memory.

## Low

### L1 — Dues listing uses a correlated subquery for SQLite-safe balance filtering
**File:** `app/Http/Controllers/Api/V1/PaymentController.php`

**Finding:** The dues endpoint uses a `whereRaw` correlated subquery to compare `price_paid` against summed payments. This is correct and test-backed, but it may become heavier than a grouped aggregate query on larger datasets.

**Impact:** Low at current scale; acceptable tradeoff for compatibility and correctness.

**Recommendation:** Revisit with real production data if dues volume grows materially; a derived table / grouped aggregate may be worth introducing later.

## Verified-Good

- **Pagination:** member, plan, subscription, payment, notification, and member-payment list endpoints paginate rather than returning unbounded collections.
- **Eager loading:** subscriptions and dues views load the related member/plan/soldBy data they expose; member photo streaming is single-record I/O, not list-based.
- **Indexes:** migrations added indexes for foreign keys and hot query columns, including `status`, `end_date`, morph keys, and plan/member relationships.
- **Queued work:** renewal reminders are dispatched through `SendRenewalReminderJob`; expiration and reminder scans are scheduled commands rather than request-path work.
- **Money math:** payment balance calculations use `bcmath`, avoiding floating-point drift on partial-payment flows.
- **N+1 posture:** no obvious query-in-loop defects surfaced in the current resources/controllers under test coverage.

## Summary

Performance is in a good place for this phase. The one area I’d keep an eye on is the dashboard expiring-soon endpoint, which currently behaves more like an in-memory report than a paginated read model. Everything else is shaped sensibly for the current backend slice.
