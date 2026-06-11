# Architecture Review — 002 Members, Subscriptions & Plans

**Date:** 2026-06-10
**Reviewer:** laravel-architecture-reviewer
**Feature:** 002-members-subscriptions-plans
**Deliverable:** T003

## Verdict: APPROVE-WITH-CHANGES

The architecture is sound and aligned with the Constitution's Laravel-first, thin-transport, and layered-design principles. The plan exhausts native Laravel features (Eloquent, Form Requests, Policies, API Resources, queues) before reaching for packages, respects the `/api/v1` versioned contract and response envelope, and correctly honors the two cross-phase integration contracts (`sold_by_user_id` referencing `users`, and the polymorphic `payments` table defined in P1). Approval is conditional on resolving the Blockers (B1–B4) before implementation begins and addressing the Majors (M1–M4) during implementation. Minors are advisory.

---

## Blockers (must resolve before implementation begins)

### B1 — Polymorphic `payments` table ownership and shape must be fixed in this phase
This phase (P1) is the **single point of definition** for the polymorphic `payments` table (`payable_type` / `payable_id`, status enum `paid` / `partial` / `due`). The plan must lock the migration, column types, status enum, and indexing for `payable_type`+`payable_id` here, because P2 (sales) and P3 (commissions/revenue) consume it without forking. Any ambiguity in column nullability, decimal precision for amounts, currency handling, or the status state machine becomes an irreversible cross-phase contract defect. Resolve and pin the exact schema before writing the migration.

### B2 — `sold_by_user_id` on subscriptions must reference `users`, not `employees`
The integration map is explicit: `sold_by_user_id` on subscriptions references `users` with **no forward dependency on `employees`**. The plan must confirm the FK target is `users(id)`, the column is nullable where a system/admin-created subscription has no salesperson, and the `on delete` behavior is declared (recommend `nullOnDelete` to preserve historical subscription records when a user is removed). P3 later links commissions via `employees.user_id` plus a backfill command — this phase must not anticipate or hard-couple to that.

### B3 — Subscription lifecycle state machine is underspecified
Subscriptions are the core aggregate of this phase, yet the lifecycle states (e.g., `pending`, `active`, `expired`, `cancelled`, `frozen`) and the legal transitions between them are not pinned down. Because payment status (`paid`/`partial`/`due`) and subscription status are distinct but related concerns, the plan must define: (a) the canonical subscription status enum, (b) allowed transitions, (c) which transitions are derived (e.g., expiry by date) versus explicitly actioned, and (d) where this logic lives (an Action/Service, never the controller). Without this, validation rules, policies, and tests cannot be written test-first.

### B4 — Plan/price snapshot strategy at subscription time is undefined
When a member subscribes to a plan, the plan's price, duration, and terms can change later. The architecture must decide whether subscriptions **snapshot** plan attributes (price, duration) at purchase time or reference the live plan row. This is a foundational data-modeling decision that affects the `subscriptions` schema, revenue reporting in P3, and refund/proration logic. Recommend snapshotting price and duration onto the subscription (or the payment) to keep historical financial records immutable. Decide and document before the migration is authored.

---

## Majors (address during implementation)

### M1 — Eager-loading contracts for Resources are not enumerated
Per the Constitution, N+1 is a defect and every relation rendered by an API Resource must be eager-loaded. The plan should enumerate, per endpoint, the `with()` set required by each Resource (e.g., `MemberResource` → active subscription + plan; `SubscriptionResource` → member, plan, payments, `soldBy` user). Make these explicit so feature tests can assert query counts.

### M2 — Indexing plan for query/filter/sort columns is incomplete
Spatie Query Builder will expose filtering and sorting. Every column used in `where` / `join` / `order by` and every FK must be indexed: `members` (search fields, status), `subscriptions` (`member_id`, `plan_id`, `sold_by_user_id`, `status`, start/end dates), `payments` (`payable_type`+`payable_id` composite, `status`). The allowlist of filterable/sortable fields must match the indexed columns to avoid unindexed scans on attacker-controllable filters.

### M3 — Authorization surface (Policies/Gates) not mapped to permissions
Thin-transport requires authorization in Policies/Gates tied to Spatie permissions, not inline checks. The plan should map each endpoint to a concrete permission (e.g., `members.view`, `members.create`, `subscriptions.create`, `subscriptions.cancel`, `payments.record`) and the corresponding Policy method. Confirm these permission names are coordinated with the Phase 0 RBAC seed so they exist at runtime.

### M4 — Queued/heavy work boundaries not identified
Heavy work (membership expiry sweeps, notification on subscription/payment state changes, any exports) must be queued, not done inline. The plan should identify which operations are synchronous (the write itself) versus deferred (notifications, downstream side effects) and define the jobs/events accordingly, so the request path stays thin and fast.

---

## Minors (advisory)

1. **Response envelope consistency** — confirm all new Resources extend the Phase 0 base envelope (`{ data, meta, message }`) and that paginated list endpoints populate `meta` consistently.
2. **`$fillable` allowlist discipline** — each new model must declare an explicit `$fillable` (never `$guarded = []`), and `$hidden` should be considered for any sensitive member PII fields.
3. **Migration reversibility** — ensure every new migration has a working `down()` and that all FKs declare explicit `on delete` behavior, per conventions.
4. **Validation message localization** — Form Request messages should follow the existing convention so error shapes remain stable across the API.
5. **Test naming / Pest-only** — all new tests must be Pest (no PHPUnit-style classes), covering happy path, 422, 401, 403, and 404 per endpoint as the Constitution mandates.

---

## Track A / Track B Routes-File Conflict Note

This phase is being delivered across two parallel tracks (Track A and Track B) that both need to register routes under the `/api/v1` group. Both tracks editing the **same `routes/api.php` (or the same versioned routes file)** will produce a merge conflict and risk one track silently dropping the other's route registrations. **Resolution:** split route registration so each track owns a dedicated route file (e.g., `routes/api/members.php` and `routes/api/subscriptions.php`) included from a single `/api/v1` group definition, OR serialize the route-file edits behind one track and have the other rebase. This must be agreed before either track touches the routes file. Treat the routes file as a shared-ownership hotspot for the duration of this phase.

---

*End of architecture review (T003).*
