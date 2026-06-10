# Data Model: Members, Subscriptions & Plans

**Feature**: `002-members-subscriptions-plans` | **Date**: 2026-06-10

Six new tables. Naming follows the Constitution: plural snake_case tables, singular models, `*_id` FKs, reversible timestamped migrations, FKs with explicit `on delete`. Every column used in `where`/`join`/`order by` or as an FK is indexed. Money is `decimal(10,2)`. See [research.md](./research.md) for the rationale behind key decisions.

---

## Entity Relationship Overview

```text
users (P0) ──< subscriptions.sold_by_user_id        (FK → users; NOT employees — Phase 3 contract)
users (P0) ──< members.created_by / *.created_by    (audit authorship)

members ──< subscriptions ──< subscription_freezes
plans   ──< subscriptions
subscriptions ──< payments (polymorphic: payable_type='App\Models\Subscription')
                  payments is polymorphic — Phase 2 attaches Sale, Phase 3 reads as revenue
users (P0) ──< notifications (Laravel DatabaseNotification; notifiable = User)
```

---

## 1. `members`

The person who interacts with the gym. Root entity of the phase.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint unsigned, PK | |
| `name` | string(150) | required |
| `phone` | string(30) | required; **indexed** (search) |
| `email` | string(150), nullable | optional; unique when present |
| `gender` | enum/string(`male`,`female`), nullable | |
| `birth_date` | date, nullable | |
| `photo_path` | string(255), nullable | path on private disk; served via Policy-gated stream |
| `national_id` | string(50), nullable | unique when present |
| `join_date` | date | default today |
| `status` | string(`active`,`inactive`) | default `active`; **indexed** (filter) |
| `notes` | text, nullable | |
| `created_by` | FK → `users.id`, nullable | `on delete set null` |
| `timestamps` | | |

**Indexes**: `phone`, `status`, unique(`email`) where not null, unique(`national_id`) where not null, `created_by`.
**Model**: `Member` — `$fillable = [name, phone, email, gender, birth_date, photo_path, national_id, join_date, status, notes, created_by]`. Casts: `birth_date`/`join_date` → date, `status` default. `LogsActivity`. Relations: `subscriptions() hasMany`, `payments()` via subscriptions (hasManyThrough), `creator() belongsTo User`.

---

## 2. `plans`

A sellable membership or offer. Subscriptions derive terms from it.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint unsigned, PK | |
| `name` | string(150) | required |
| `description` | text, nullable | |
| `price` | decimal(10,2) | required, `>= 0` |
| `duration_days` | unsigned int | required, `>= 1` |
| `sessions_count` | unsigned int, nullable | optional (session-based plans) |
| `type` | string(`membership`,`offer`) | **indexed** |
| `is_active` | boolean | default true; **indexed** (filter + sale validity) |
| `valid_from` | date, nullable | validity window start |
| `valid_to` | date, nullable | validity window end; must be `>= valid_from` |
| `max_freeze_days` | unsigned int | default 0; freeze allowance cap |
| `timestamps` | | |

**Indexes**: `type`, `is_active`. **Validation**: `valid_to >= valid_from`; `max_freeze_days <= duration_days` (a freeze cannot exceed the plan length); `price >= 0`.
**Model**: `Plan` — explicit `$fillable`. Casts: `price` → decimal:2, `is_active` → bool, dates → date. `LogsActivity`. Relations: `subscriptions() hasMany`.
**Sale-time validity**: a plan is sellable when `is_active = true` AND (`valid_from` is null OR `valid_from <= today`) AND (`valid_to` is null OR `valid_to >= today`). Re-checked at subscription creation (research §2/FR-008).

---

## 3. `subscriptions`

A member holding a plan over a date range. Renewal creates a new row (history preserved).

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint unsigned, PK | |
| `member_id` | FK → `members.id` | `on delete cascade`; **indexed** |
| `plan_id` | FK → `plans.id` | `on delete restrict`; **indexed** |
| `start_date` | date | derived at creation |
| `end_date` | date | **effective** end date (includes added freeze days); **indexed** (expiry/expiring queries) |
| `status` | string(`active`,`expired`,`frozen`,`stopped`) | default `active`; **indexed** |
| `price_paid` | decimal(10,2) | agreed post-discount amount owed |
| `discount` | decimal(10,2) | default 0 |
| `sold_by_user_id` | FK → `users.id`, nullable | **users, NOT employees** (Phase 3 contract); `on delete set null`; **indexed** |
| `created_by` | FK → `users.id`, nullable | `on delete set null` |
| `timestamps` | | |

**Indexes**: `member_id`, `plan_id`, `status`, `end_date`, `sold_by_user_id`, composite (`status`,`end_date`) for the expiry/expiring-soon queries.
**Model**: `Subscription` — explicit `$fillable` (note: `status`, `start_date`, `end_date`, `sold_by_user_id` are set by Actions, never from raw client input). Casts: dates → date, `price_paid`/`discount` → decimal:2. `LogsActivity`. Relations: `member() belongsTo`, `plan() belongsTo`, `soldBy() belongsTo User`, `freezes() hasMany SubscriptionFreeze`, `payments() morphMany Payment`.

### Status transitions (state engine)

```text
            create
              │
              ▼
          ┌────────┐  freeze   ┌────────┐
          │ active │ ────────▶ │ frozen │
          │        │ ◀──────── │        │
          └────────┘ unfreeze  └────────┘
            │   │                  │
       stop │   │ expiry job       │ stop
            │   │ (end_date<today) │
            ▼   ▼                  ▼
        ┌─────────┐           ┌─────────┐
        │ stopped │           │ expired │
        └─────────┘           └─────────┘
```

- **active → frozen**: only if `plan.max_freeze_days > 0` and cumulative freeze days (incl. new) `<= max_freeze_days`. Adds `days` to `end_date`.
- **frozen → active**: unfreeze. `end_date` unchanged (days already added).
- **active/frozen → stopped**: stop. Excluded from active/expiring calcs.
- **active → expired**: expiry command when `end_date < today`. **Frozen and stopped are never auto-expired.**
- **Invalid**: freeze/unfreeze on `stopped`/`expired` → rejected (422). Stop on `expired` → rejected or no-op (documented).

---

## 4. `subscription_freezes`

A bounded freeze period; the audit trail and cumulative-cap source.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint unsigned, PK | |
| `subscription_id` | FK → `subscriptions.id` | `on delete cascade`; **indexed** |
| `freeze_start` | date | |
| `freeze_end` | date | `>= freeze_start` |
| `days` | unsigned int | inclusive day count; `>= 1` |
| `reason` | string(255), nullable | |
| `created_by` | FK → `users.id`, nullable | `on delete set null` |
| `timestamps` | | |

**Indexes**: `subscription_id`. **Model**: `SubscriptionFreeze` — explicit `$fillable`. Relations: `subscription() belongsTo`. Cumulative enforcement: `SUM(days) WHERE subscription_id = ?` compared to `plan.max_freeze_days` before insert.

---

## 5. `payments` (polymorphic — cross-phase contract)

Defined **once** here. Phase 2 attaches `Sale`; Phase 3 reads as the single revenue source. **Do not fork.**

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint unsigned, PK | |
| `payable_type` | string | morph; **indexed** (composite with id) |
| `payable_id` | bigint unsigned | morph |
| `amount` | decimal(10,2) | `> 0` |
| `method` | string(`cash`,`card`,`transfer`,…) | |
| `status` | string(`paid`,`partial`,`due`) | **indexed** (dues filter) |
| `paid_at` | datetime, nullable | set when money received |
| `due_date` | date, nullable | for scheduled dues |
| `created_by` | FK → `users.id`, nullable | `on delete set null` |
| `timestamps` | | |

**Indexes**: `index(payable_type, payable_id)` (morph default), `status`, `due_date`.
**Model**: `Payment` — explicit `$fillable`. Casts: `amount` → decimal:2, `paid_at` → datetime, `due_date` → date. `LogsActivity`. Relations: `payable() morphTo`, `creator() belongsTo User`.
**Derived balance** for a subscription: `subscription.price_paid − SUM(payments.amount WHERE payable = subscription)`. `> 0` ⇒ appears in dues. Overpayment (`sum > price_paid`) rejected at `RecordPayment` (422). Computed with `bcmath` (research §3).

---

## 6. `notifications` (Laravel native)

Standard Laravel notifications table (published via `php artisan make:notifications-table` shape) — UUID `id`, `type`, `notifiable_type`/`notifiable_id` (morph), `data` (json), `read_at`, timestamps. Used for renewal reminders (in-app) with the `notifiable` being the recipient user. Mark-as-read sets `read_at`. **Indexes**: morph index on (`notifiable_type`,`notifiable_id`), `read_at` lookups handled by the morph + native scopes.

> Using the framework table verbatim preserves the reusable notifications/realtime pattern for Phases 2–3 (Integration Map).

---

## Cross-cutting rules

- **Mass assignment**: every model declares an explicit `$fillable`; server-controlled fields (`status`, computed dates, `sold_by_user_id`, `created_by`) are written by Actions, never bound from request input.
- **FK `on delete`**: `cascade` for owned children (subscriptions→freezes/payments, member→subscriptions), `set null` for authorship (`created_by`, `sold_by_user_id`), `restrict` for `plan_id` (don't delete a plan with live subscriptions).
- **Reversibility**: every migration implements `down()` (drop table). Morphs added with explicit index names to keep `down()` clean.
- **Eager loading** (no N+1): `SubscriptionResource` loads `member`, `plan`, `soldBy` (+ its roles/permissions per PERF-1), `payments`; `MemberResource` (profile) loads `subscriptions.plan` and aggregates payments; list endpoints paginate.
- **Indexes for the hot queries**: expiry job & expiring-soon list both hit `(status, end_date)`; dues list hits `payments.status`; member search hits `members.phone`/`name` + `status`.
