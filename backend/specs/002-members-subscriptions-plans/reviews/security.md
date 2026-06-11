# Members, Subscriptions & Plans — Security Review (T106)

**Reviewer:** laravel-security-reviewer
**Date:** 2026-06-11
**Scope:** Members, plans, subscriptions, lifecycle actions, payments, reminders, notifications, dashboard, related routes/resources/requests/models.
**Reference:** `.specify/memory/constitution.md` Principle V (Security by Default).

## Verdict: PASS

No Critical or High findings remain in the shipped Phase 1 backend slice. Authentication, authorization boundaries, validation, mass-assignment posture, private member-photo handling, notification permissions, member audit privacy, and server-controlled subscription/payment fields are aligned with the constitution. One Medium operational exposure note remains, but it does not block this phase.

---

## Critical

None.

## High

None.

## Medium

### M1 — Payment dues listing exposes member names to anyone with `payments.view`
**Files:** `app/Http/Controllers/Api/V1/PaymentController.php`, `routes/api/payments.php`

**Finding:** The dues endpoint returns outstanding subscription balance plus embedded member identity (`id`, `name`) for all due accounts. This is likely intended for accountant/cashier workflows, but it is broader than “my own data” access and should remain intentional.

**Impact:** Acceptable for staff operations, but this is sensitive operational data. Future role changes should be reviewed carefully so lower-privilege roles do not inherit `payments.view` casually.

**Recommendation:** Keep the current role mapping narrow and document the exposure explicitly in role/permission reviews.

## Verified-Good

- **Mass assignment:** `Member`, `Plan`, `Subscription`, `SubscriptionFreeze`, `Payment`, and `Setting` all use explicit `$fillable` allowlists; there is no blanket `$guarded = []`.
- **Server-controlled fields:** subscription `status`, `end_date`, `sold_by_user_id`, and payment balance/status behavior are derived in Actions, not trusted from client input.
- **Validation boundaries:** input validation is in Form Requests (`Members`, `Plans`, `Subscriptions`, `Payments`, `Notifications`), not inline in controllers.
- **Authorization boundaries:** protected endpoints enforce policies or permission middleware. Notification routes enforce `notifications.view`; member-payment access requires both `members.view` and `payments.view`; payment creation requires target subscription visibility.
- **Audit privacy:** `Member` activity logging is narrowed to non-sensitive fields (`status`, `created_by`) so phone/email/national ID/photo path/notes are not duplicated into `activity_log`.
- **Private media:** member photos are stored on the private `local` disk and streamed through a policy-gated controller action rather than exposed as public URLs.
- **Notification privacy:** `NotificationController` scopes reads and mark-read operations to `$request->user()->notifications()`, preventing cross-user access.
- **Abuse controls:** notification mark-read writes are throttled; payment and notification index filters are validated.
- **Query safety:** no raw concatenated SQL was introduced; raw SQL fragments are static and do not concatenate user-controlled input.
- **Secret handling:** no credentials or provider secrets are hardcoded; messaging/provider configuration stays in environment-backed config.

## Summary

This phase meets the constitution’s required security gates. The strongest parts are the explicit validation/authorization separation, private-photo handling, own-scoped notification access with explicit permission gating, member audit privacy, and the fact that subscription/payment state remains server-controlled.
