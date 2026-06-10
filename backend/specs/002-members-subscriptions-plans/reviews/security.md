# Members, Subscriptions & Plans — Security Review (T106)

**Reviewer:** laravel-security-reviewer
**Date:** 2026-06-10
**Scope:** Members, plans, subscriptions, lifecycle actions, payments, reminders, notifications, dashboard, related routes/resources/requests/models.
**Reference:** `.specify/memory/constitution.md` Principle V (Security by Default).

## Verdict: PASS

No Critical or High findings were identified in the shipped Phase 1 backend slice. Authentication, authorization boundaries, validation, mass-assignment posture, private member-photo handling, and server-controlled subscription/payment fields are all aligned with the constitution. A few Medium follow-ups remain worth tightening, but they do not block this phase.

---

## Critical

None.

## High

None.

## Medium

### M1 — Notification endpoints are authenticated and own-scoped, but not explicitly permission-gated
**Files:** `routes/api/notifications.php`, `app/Http/Controllers/Api/V1/NotificationController.php`

**Finding:** The notifications endpoints rely on `auth:sanctum` plus current-user scoping. That is safe for the current “own notifications only” behavior, but it does not enforce the `notifications.view` permission introduced in `MembershipPermissions`.

**Impact:** Low current risk because users can only access their own notifications, but it is a contract drift from the permissions catalog and reduces administrative control over who may use the inbox endpoints.

**Recommendation:** Either add `permission:notifications.view` middleware to the routes or explicitly document that notification inbox access is any-authenticated-user by design and remove the unused permission constant.

### M2 — Payment dues listing exposes member names to anyone with `payments.view`
**Files:** `app/Http/Controllers/Api/V1/PaymentController.php`, `routes/api/payments.php`

**Finding:** The dues endpoint returns outstanding subscription balance plus embedded member identity (`id`, `name`) for all due accounts. This is likely intended for accountant/cashier workflows, but it is broader than “my own data” access and should remain intentional.

**Impact:** Acceptable for staff operations, but this is sensitive operational data. Future role changes should be reviewed carefully so lower-privilege roles do not inherit `payments.view` casually.

**Recommendation:** Keep the current role mapping narrow and document the exposure explicitly in role/permission reviews.

### M3 — Dashboard expiring-soon currently reuses reminder eligibility logic
**Files:** `app/Http/Controllers/Api/V1/DashboardController.php`, `app/Actions/Reminders/FindExpiringSubscriptions.php`

**Finding:** `GET /dashboard/expiring-soon` excludes subscriptions already reminded today because it reuses the reminder finder. This is not an access-control bug, but it can hide valid expiring subscriptions from authorized staff if they were already notified earlier the same day.

**Impact:** Operational visibility risk rather than a direct security flaw.

**Recommendation:** Split dashboard read logic from reminder-delivery eligibility so the dashboard reflects all in-window expiring subscriptions.

## Verified-Good

- **Mass assignment:** `Member`, `Plan`, `Subscription`, `SubscriptionFreeze`, `Payment`, and `Setting` all use explicit `$fillable` allowlists; there is no blanket `$guarded = []`.
- **Server-controlled fields:** subscription `status`, `end_date`, `sold_by_user_id`, and payment balance/status behavior are derived in Actions, not trusted from client input.
- **Validation boundaries:** input validation is in Form Requests (`Members`, `Plans`, `Subscriptions`, `Payments`), not inline in controllers.
- **Authorization boundaries:** protected endpoints enforce policies or permission middleware; controllers do not hand-roll role checks.
- **Private media:** member photos are stored on the private `local` disk and streamed through a policy-gated controller action rather than exposed as public URLs.
- **Notification privacy:** `NotificationController` scopes reads and mark-read operations to `$request->user()->notifications()`, preventing cross-user access.
- **Query safety:** no raw concatenated SQL was introduced; the one raw dues expression uses a bound parameter for the polymorphic type.
- **Secret handling:** no credentials or provider secrets are hardcoded; messaging/provider configuration stays in environment-backed config.

## Summary

This phase meets the constitution’s required security gates. The strongest parts are the explicit validation/authorization separation, private-photo handling, and the fact that subscription/payment state remains server-controlled. The main cleanup item is deciding whether notifications should stay auth-only or become explicitly permission-gated.
