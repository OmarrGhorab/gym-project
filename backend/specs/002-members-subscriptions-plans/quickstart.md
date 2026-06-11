# Quickstart & Validation Guide: Members, Subscriptions & Plans

**Feature**: `002-members-subscriptions-plans`

This is a validation/run guide that proves Phase 1 works end-to-end against the API. It references [contracts/api.md](./contracts/api.md) and [data-model.md](./data-model.md) for shapes; it does not duplicate implementation. Implementation lives in `tasks.md` and the code.

## Prerequisites

- Phase 0 foundation merged (auth, permissions, envelope, settings, queue, scheduler, storage) — done.
- PHP **8.4** binary for all tooling: `~/.config/herd-lite/bin/php` (the default PATH `php` is 8.2 and fails the platform check).
- Migrations + seeders applied; `settings.reminder_days` set (defaults to 7 if unset).

## Setup commands

```bash
PHP=~/.config/herd-lite/bin/php

$PHP artisan migrate            # creates members, plans, subscriptions, subscription_freezes, payments, notifications
$PHP artisan db:seed --class=MembershipAccessSeeder   # registers members.*/plans.*/subscriptions.*/payments.* + role assignments
# (optional) set the reminder lead time:
$PHP artisan tinker --execute "(new App\\Actions\\Settings\\StoreSetting)->execute('reminder_days', 7);"
```

## Test commands

```bash
PHP=~/.config/herd-lite/bin/php

$PHP artisan test                                   # full Pest suite (must be green)
$PHP artisan test tests/Unit/Actions                # freeze math, renewal history, dues precision
$PHP artisan test tests/Feature/Api/V1/Subscriptions # subscription lifecycle endpoints
vendor/bin/pint --test                              # formatting gate
```

---

## End-to-end demo flow (mirrors the source phase Demo Checklist)

Authenticate as an Admin (Phase 0 `POST /auth/login`) and use the returned token as `Authorization: Bearer …` for every step.

### 1. Register a member (US1)
`POST /members` with name + phone → **201**, `status=active`. Confirm it appears in `GET /members?search=<phone>`.
**Expected**: member created, `created_by` = current user, searchable, paginated list.

### 2. Create a plan (US2)
`POST /plans` with `price`, `duration_days`, `valid_from/valid_to`, `max_freeze_days` → **201**. Toggle and re-check with `PATCH /plans/{id}/toggle`.
**Expected**: plan stored; toggling flips `is_active`; an inactive/out-of-window plan is rejected at sale time.

### 3. Sell a subscription (US3)
`POST /subscriptions` with `member_id`, `plan_id`, a partial `payment.amount` (less than `price_paid`) → **201**.
**Expected**: `status=active`; `end_date = start_date + duration_days` exactly; `sold_by_user_id` = current user; a `payment` row exists with `status=partial`.

### 4. Record the remaining payment / inspect dues (US5)
`GET /payments?status=due` → the subscription's outstanding balance appears.
`POST /payments` for the remaining amount → **201**, payment `status=paid`.
**Expected**: balance = `price_paid − SUM(amount)` to the cent; once cleared, the subscription drops off the dues list. The dues payload is a paginated list of outstanding subscriptions with `subscription`, `member`, `balance`, `paid_total`, and `price_paid`. Overpayment → **422**.

### 5. Freeze then unfreeze (US4)
`POST /subscriptions/{id}/freeze` for N days (≤ `max_freeze_days`) → **200**, `status=frozen`, `end_date` extended by exactly N days, a `subscription_freezes` row created.
`POST /subscriptions/{id}/unfreeze` → **200**, `status=active`, end date unchanged from the frozen value.
**Expected**: exceeding the cumulative freeze cap → **422**, no change; freezing a stopped/expired subscription → **422**.

### 6. Renew (US3)
`POST /subscriptions/{id}/renew` → **201**, a **new** subscription row; the original remains in `GET /members/{id}` history.
**Expected**: contiguous start if unexpired (day after current `end_date`), today if lapsed; both subscriptions visible on the member profile.

### 7. Trigger reminders + expiry (US6)
Seed a subscription expiring within `reminder_days`, then:
```bash
$PHP artisan subscriptions:send-renewal-reminders
$PHP artisan subscriptions:expire
```
`GET /notifications?unread=true` → the renewal reminder is present. `POST /notifications/{id}/read` → it leaves the unread set.
**Expected**: only in-window subscriptions get exactly one reminder (re-running the command does **not** duplicate it); only past-`end_date` active subscriptions become `expired` (frozen/stopped untouched); a missing external provider never blocks the in-app notification.

### 8. Dashboard read models (US7)
`GET /dashboard/active-subscriptions` → count matches active rows.
`GET /dashboard/expiring-soon` → exactly the in-window subscriptions, paginated.
**Expected**: active subscriptions within `settings.reminder_days` are returned with real pagination, even if they were already reminded today.

---

## Authorization & contract checks (every endpoint)

For each endpoint, confirm:
- **401** when unauthenticated.
- **403** when authenticated but lacking the specific permission (e.g., `members.view` without `members.update` can read but not modify).
- **422** with field-level `details` on invalid input.
- **404** for missing resources.
- Success envelope `{ data, meta, message }`; collections carry pagination `meta`.
- No N+1 (assert query counts on list endpoints embedding member/plan/soldBy).

## Definition of Done (validates spec Success Criteria)

- [ ] Member CRUD + photo (private, Policy-gated stream) — SC-001, SC-007.
- [ ] Plan CRUD + toggle + validity enforced at sale — SC-009.
- [ ] Subscription create: `active`, correct `end_date`, `sold_by_user_id`, linked payment — SC-001.
- [ ] Renew creates a new row; history preserved — SC-003.
- [ ] Freeze extends end date by exactly N; cap enforced; unfreeze resumes — SC-002.
- [ ] Stop → `stopped`; expiry command → `expired` (frozen/stopped excluded) — SC-006.
- [ ] Partial payment leaves an exact due; dues list accurate; no rounding residue — SC-004.
- [ ] Reminder fires once per in-window subscription; in-app delivery independent of provider — SC-005.
- [ ] Every endpoint: 401/403/422/404 covered by feature tests; envelope correct — SC-007, SC-009.
- [ ] Lists paginated, relations eager-loaded (no N+1) — SC-008.
- [ ] Full demo flow green end-to-end — SC-010.
