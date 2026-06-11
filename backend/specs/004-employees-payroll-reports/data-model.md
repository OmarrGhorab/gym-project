# Phase 1 — Data Model: Employees, Payroll, Commissions & Reports

Four new tables and three additive modifications to existing Phase 0–2 tables. All money is `decimal(10,2)`; rates are `decimal(5,4)` fractions; `month` is `char(7)` `YYYY-MM`. Every model uses an explicit `$fillable` allowlist and `LogsActivity`.

---

## New table: `employees`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `user_id` | bigint FK→`users` **nullable, unique** | `nullOnDelete`. The bridge for `sold_by_user_id`. Unique = one employee per user. |
| `name` | string(255) | |
| `phone` | string(30) nullable | |
| `role` | string(20) | `employee` \| `captain` \| `manager` (default `employee`). Indexed. |
| `base_salary` | decimal(10,2) | default `0.00` |
| `commission_rate` | decimal(5,4) | default `0.0000` (e.g. `0.1000` = 10%) |
| `hire_date` | date nullable | |
| `status` | string(20) | `active` \| `inactive` (default `active`). Indexed. |
| `timestamps` | | |

**Indexes**: `user_id` (unique), `status`, `role`.
**Relations**: `belongsTo(User)`; `hasMany(Commission)`; `hasMany(Payroll)`.
**Rules**: changing `base_salary`/`commission_rate` never mutates existing commissions/payroll (FR-005). Inactive employees excluded from `GeneratePayroll` (FR-003).

---

## New table: `commissions`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `employee_id` | bigint FK→`employees` | `cascadeOnDelete` is **rejected** — use `restrictOnDelete` to preserve financial history; deletion blocked while commissions exist. |
| `source_type` / `source_id` | morphs | → `Subscription` \| `Sale`. **unique together** (idempotency). |
| `rate` | decimal(5,4) | resolved rate applied (snapshot) |
| `amount` | decimal(10,2) | `bcmul(base, rate, 2)` |
| `month` | char(7) | `YYYY-MM` from source `created_at` |
| `status` | string(20) | `pending` \| `paid` (default `pending`) |
| `timestamps` | | |

**Indexes**: unique `(source_type, source_id)`; composite `(employee_id, month, status)`.
**Relations**: `belongsTo(Employee)`; `morphTo(source)`.
**State**: `pending → paid` (set when the covering payroll is marked paid). No hard delete on void/refund — discrepancy surfaced via report, not auto-mutation.

---

## New table: `payroll`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `employee_id` | bigint FK→`employees` `restrictOnDelete` | |
| `month` | char(7) | `YYYY-MM` |
| `base_salary` | decimal(10,2) | snapshot at generation |
| `commissions_total` | decimal(10,2) | `SUM(commissions.amount)` for employee+month |
| `bonuses` | decimal(10,2) | default `0.00` |
| `deductions` | decimal(10,2) | default `0.00` |
| `net_salary` | decimal(10,2) | `base + commissions_total + bonuses − deductions`, must be ≥ 0 |
| `status` | string(20) | `pending` \| `paid` (default `pending`) |
| `paid_at` | datetime nullable | set on pay |
| `timestamps` | | |

**Indexes**: unique `(employee_id, month)` (no duplicate generation, FR-015); `(month, status)`.
**Relations**: `belongsTo(Employee)`.
**State**: `pending → paid` (atomic: commissions→paid + expense payout written). Bonuses/deductions editable only while `pending`.

---

## New table: `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `category` | string(50) | free category incl. reserved `payroll` for payouts |
| `amount` | decimal(10,2) | |
| `description` | text nullable | |
| `date` | date | indexed |
| `created_by` | bigint FK→`users` nullable | `nullOnDelete` |
| `timestamps` | | |

**Indexes**: `date`, `category`.
**Relations**: `belongsTo(User, 'created_by')` as `creator`.

---

## Additive modifications to existing tables

### `plans` — add `commission_rate`
`decimal(5,4) nullable` after `price`. Plan-level override for subscription commissions (`?? employee.commission_rate`). Reversible `down()` drops the column. Add to `Plan::$fillable` + cast `decimal:4`.

### `payments` — add read-path indexes
Add composite `(status, paid_at)` (revenue read path) and `(payable_type, payable_id, status)` (per-source lookup, phase-mandated). No column/data change. `down()` drops both indexes.

### `sales` / `subscriptions` — add seller indexes
`sales`: add `(sold_by_user_id, created_at)`. `subscriptions`: add `(sold_by_user_id)`. Serve per-employee performance + backfill scans. `down()` drops them.

### `users` — additive relation (no migration)
`User::employee(): HasOne(Employee)`.

---

## Entity relationships

```text
users ──1:0..1── employees ──1:N── commissions ──morph──> subscriptions | sales
                    │                                          │
                    └──1:N── payroll                           └── payments (status=paid) ──> revenue
employees.user_id ⇄ subscriptions.sold_by_user_id / sales.sold_by_user_id   (commission attribution)
payroll (status=paid) ──writes──> expenses (category=payroll)
expenses ──Σ──> report expenses ;  payments(paid) ──Σ──> report revenue ;  net = revenue − expenses
```

---

## Derived / computed values (not stored)

- **Financial report**: revenue `SUM(payments.amount WHERE status='paid')` by `paid_at` bucket; expenses `SUM(expenses.amount)` by `date`; net = difference. JOIN-free aggregates merged per period.
- **Employee performance**: `sales_count`, `subscriptions_count`, `commissions_earned` via JOINs on `sold_by_user_id = employees.user_id` for the range.
- **Captain leaderboard**: `SUM(commissions.amount)` grouped by `employee_id` for current month, ordered desc.
- **Low-stock / expiring-soon / sales-today / top-products**: reused from Phase 1/2 logic inside the dashboard summary.
