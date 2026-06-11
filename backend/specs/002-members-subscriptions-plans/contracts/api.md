# API Contract: Members, Subscriptions & Plans (Phase 1)

Base path: `/api/v1`

All endpoints reuse the Phase 0 envelope. Every non-public endpoint requires `auth:sanctum` **and** a specific permission (enforced via Policy / `permission:` middleware). Collections are paginated; pagination metadata is returned in `meta`. Standard error codes: `validation_failed` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `too_many_requests` (429), `server_error` (500).

## Response Shapes

### Success

```json
{ "data": {}, "meta": {}, "message": "Human-readable message" }
```

### Error

```json
{ "error": { "code": "machine_readable_code", "message": "…", "details": {} } }
```

### Pagination meta (collection endpoints)

```json
{ "meta": { "current_page": 1, "per_page": 15, "total": 120, "last_page": 8 } }
```

---

## Members

### GET /members
**Auth**: `members.view`. **Query**: `?search=` (name/phone), `?status=active|inactive`, `?sort=`, `?page=`. Paginated `MemberResource` collection.

### POST /members
**Auth**: `members.create`. **Request**:
```json
{ "name": "Sara Ali", "phone": "+201234567890", "email": "sara@example.com",
  "gender": "female", "birth_date": "1995-04-12", "national_id": "298…",
  "join_date": "2026-06-10", "notes": "..." }
```
**201**: created `MemberResource` (status defaults `active`, `created_by` = current user). **422** on invalid/duplicate `email`/`national_id`.

### GET /members/{id}
**Auth**: `members.view`. **200**: `MemberResource` (may embed subscription history + dues summary, eager-loaded). **404** if absent.

### PUT /members/{id}
**Auth**: `members.update`. Partial member fields. **200** updated. **422**/**404**.

### DELETE /members/{id}
**Auth**: `members.delete`. Soft deactivate (sets `status=inactive`) or delete per policy; retains financial records (never orphaned). **200/204**.

### POST /members/{id}/photo
**Auth**: `members.update`. **multipart/form-data** `photo` (image `jpg/jpeg/png/webp`, ≤ ~5 MB). **200**: member with `photo` reference. **422** on bad type/size.

### GET /members/{id}/photo
**Auth**: `members.view` (Policy-gated stream — SEC-M3). Streams the private file. **404** if none.

### GET /members/{id}/payments
**Auth**: `members.view` + `payments.view`. Paginated `PaymentResource` for the member's subscriptions.

---

## Plans

### GET /plans
**Auth**: `plans.view`. **Query**: `?type=membership|offer`, `?is_active=`, `?sort=`, `?page=`. Paginated `PlanResource`.

### POST /plans
**Auth**: `plans.create`. **Request**:
```json
{ "name": "Monthly", "description": "...", "price": "300.00", "duration_days": 30,
  "sessions_count": null, "type": "membership", "is_active": true,
  "valid_from": "2026-06-01", "valid_to": "2026-12-31", "max_freeze_days": 7 }
```
**201**: `PlanResource`. **422** if `price < 0`, `valid_to < valid_from`, or `max_freeze_days > duration_days`.

### PUT /plans/{id}
**Auth**: `plans.update`. **200**/**422**/**404**.

### PATCH /plans/{id}/toggle
**Auth**: `plans.update`. Flips `is_active`. **200**: `PlanResource` with new state.

---

## Subscriptions

### GET /subscriptions
**Auth**: `subscriptions.view`. **Query**: `?member_id=`, `?status=active|expired|frozen|stopped`, `?sort=`, `?page=`. Paginated `SubscriptionResource` (eager-loads member, plan, soldBy).

### POST /subscriptions
**Auth**: `subscriptions.create`. **Request**:
```json
{ "member_id": 1, "plan_id": 2, "start_date": "2026-06-10",
  "discount": "0.00", "payment": { "amount": "150.00", "method": "cash" } }
```
Server derives `end_date = start_date + plan.duration_days`, sets `status=active`, records `sold_by_user_id` = current user, computes `price_paid = plan.price − discount`, and creates a `payment` (partial if `payment.amount < price_paid`). **201**: `SubscriptionResource`. **422** if plan inactive/out-of-validity-window or member inactive. **403** without permission.

### GET /subscriptions/{id}
**Auth**: `subscriptions.view`. **200**: `SubscriptionResource` (+ freezes, payments). **404**.

### POST /subscriptions/{id}/renew
**Auth**: `subscriptions.renew`. Optional `{ "plan_id": 3, "discount": "...", "payment": {…} }`. Creates a **new** subscription row (history preserved); start date per research §2. **201**: the new `SubscriptionResource`.

### POST /subscriptions/{id}/freeze
**Auth**: `subscriptions.freeze`. **Request**: `{ "freeze_start": "2026-07-01", "freeze_end": "2026-07-07", "reason": "travel" }`. Creates a freeze, sets `status=frozen`, extends `end_date` by the day count. **200**. **422** if cumulative days exceed `plan.max_freeze_days` or subscription not active.

### POST /subscriptions/{id}/unfreeze
**Auth**: `subscriptions.freeze`. Sets `status=active` (end date already extended). **200**. **422** if not frozen.

### POST /subscriptions/{id}/stop
**Auth**: `subscriptions.stop`. Sets `status=stopped`. **200**. **422** if already expired/stopped (documented).

---

## Payments

### POST /payments
**Auth**: `payments.create` + `subscriptions.view` on the target subscription. **Request**:
```json
{ "subscription_id": 5, "amount": "150.00", "method": "cash", "paid_at": "2026-06-10" }
```
Records a payment against the subscription; sets payment `status` (`paid` clears balance, `partial` leaves a due). **201**: `PaymentResource`. **422** on invalid status filter/overpayment/settled subscription. **404** if subscription missing. **403** without payment create permission or target subscription visibility.

### GET /payments
**Auth**: `payments.view`. **Query**: `?status=paid|partial|due`, `?page=`. Invalid `status` returns **422**.

When `status=due`, the response is a paginated outstanding-subscriptions view, not `PaymentResource` items:
```json
{
  "data": [
    {
      "subscription": {
        "id": 5,
        "status": "active",
        "start_date": "2026-06-10",
        "end_date": "2026-07-10"
      },
      "member": {
        "id": 8,
        "name": "Sara Ali"
      },
      "balance": "150.00",
      "paid_total": "150.00",
      "price_paid": "300.00"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 1,
    "last_page": 1
  },
  "message": "Dues retrieved"
}
```

For other statuses, the endpoint returns paginated `PaymentResource` items.

---

## Notifications

### GET /notifications
**Auth**: `notifications.view` (own notifications). **Query**: `?unread=true`, `?page=`. Paginated `NotificationResource` for the current user.

### POST /notifications/{id}/read
**Auth**: `notifications.view` (own). Sets `read_at`. **200**. **404** if not the user's notification.

---

## Dashboard read models

### GET /dashboard/active-subscriptions
**Auth**: `dashboard.view`. **200**: `{ "data": { "count": 128 }, "meta": {}, "message": "..." }` — count of currently-active subscriptions.

### GET /dashboard/expiring-soon
**Auth**: `dashboard.view`. **Query**: `?page=`.

Returns a paginated `SubscriptionResource` collection for active subscriptions whose `end_date` is within `settings.reminder_days`. Dashboard visibility is independent from reminder idempotency, so subscriptions already reminded today still appear here.

---

## Scheduled (non-HTTP) processes

| Command | Schedule | Behavior |
|---------|----------|----------|
| `subscriptions:send-renewal-reminders` | daily | Finds active subscriptions with `end_date` within `settings.reminder_days`; dispatches queued reminder jobs → in-app notification (+ provider hook if configured). Idempotent per subscription per day. |
| `subscriptions:expire` | daily | Sets `status=expired` for active subscriptions with `end_date < today`. Frozen/stopped untouched. |

---

## Cross-phase contracts honored

- `subscriptions.sold_by_user_id` → **`users`** (never `employees`).
- `payments` polymorphic (`payable_type`/`payable_id`, status `paid|partial|due`) — defined once, reused by Phase 2, read by Phase 3.
- `notifications` native table + realtime channel pattern — reused by Phases 2–3.
- `settings.reminder_days` — consumed here, managed in Phase 4.
