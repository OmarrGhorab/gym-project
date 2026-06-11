# Quickstart — Phase 3: Employees, Payroll, Commissions & Reports

A runnable validation guide proving the phase end-to-end. Mirrors the Demo Checklist in the phase doc: *create a captain → a prior subscription/sale shows a commission (backfill) → generate the month's payroll → financial report shows net profit → dashboard leaderboard ranks captains.*

## Prerequisites

- Phases 0–2 migrated and seeded; `composer setup` already run.
- A user with the Admin role (full HR/finance permissions).
- Tooling PHP: use `~/.config/herd-lite/bin/php` if PATH `php` is 8.2.

## Setup

```bash
php artisan migrate                 # applies 4 new tables + plans.commission_rate + index migrations
php artisan db:seed --class=HrFinanceAccessSeeder
php artisan test --filter=Employees   # then Payroll, Commissions, Reports — all green first (test-first)
```

## Scenario 1 — Employee/captain CRUD + user link (US1)

1. `POST /api/v1/employees` with `{ name, role: "captain", base_salary: "5000.00", commission_rate: "0.1000", user_id: <captainUserId> }` → **201**.
2. `POST /api/v1/employees` again with the **same** `user_id` → **422** (unique link).
3. `GET /api/v1/employees/{id}` → profile returns the employee + linked user summary.

**Expected**: link is unique; rates/salary stored as decimal strings.

## Scenario 2 — Live commission on a new sale/subscription (US2)

1. As the linked captain, create a subscription (Phase 1 flow) and a sale (Phase 2 flow).
2. `GET /api/v1/employees/{id}/commissions?month=<thisMonth>` → **200** with two commissions.

**Expected**: subscription commission `amount = price_paid × (plan.commission_rate ?? employee rate)`; sale commission `amount = total × employee rate`; both `status: pending`; created automatically (no manual endpoint).

## Scenario 3 — Backfill historical data (US2)

1. Ensure a subscription/sale exists that predates the captain link (or pre-existing data).
2. `POST /api/v1/commissions/backfill` → **200** `{ created: N, skipped_unlinked, already_present, scanned }`.
3. Run it **again** → `created: 0` (idempotent, FR-011 / SC-002).

**Expected**: every qualifying historical record now has exactly one commission; unlinked-seller records are skipped and counted.

## Scenario 4 — Payroll generation + pay (US3)

1. `POST /api/v1/payroll/generate?month=<thisMonth>` → **200** payroll for each active employee.
2. Verify the captain's entry: `net_salary == base_salary + commissions_total + bonuses − deductions`.
3. `PUT /api/v1/payroll/{id}` `{ bonuses: "200.00", deductions: "50.00" }` → net recomputes.
4. `POST /api/v1/payroll/{id}/pay` → **200** `status: paid`.
5. Confirm: the month's commissions are now `paid`, and an expense `category: payroll` of `net_salary` exists.
6. Re-run generate for the same month → no duplicate entries (FR-015).

**Expected**: arithmetic exact (SC-003); paying writes exactly one payout expense (SC-009).

## Scenario 5 — Financial report reconciles (US5)

1. `GET /api/v1/reports/financial?from=<start>&to=<end>&group_by=month`.
2. Check `meta.totals`: `revenue − expenses == net_profit` exactly.

**Expected**: revenue counts **paid** payments only (partial/due excluded, FR-023); expenses include the payroll payout; empty periods return zeros (SC-004).

## Scenario 6 — Per-employee performance (US6)

1. `GET /api/v1/reports/employees?from=<start>&to=<end>` → per-employee `sales_count`, `subscriptions_count`, `commissions_earned`.

**Expected**: figures match seeded data and are attributed only to each employee's linked user (SC-005).

## Scenario 7 — Dashboard summary + leaderboard (US7)

1. `GET /api/v1/dashboard/summary` → `active_subscriptions`, `revenue_mtd`, `expiring_soon`, `sales_today`, `top_products`, `captain_leaderboard`.

**Expected**: leaderboard ranks captains by current-month commissions, highest first (SC-006); repeated calls served from cache; a new commission invalidates and updates the figure.

## Authorization checks (all scenarios)

- Unauthenticated → **401**. Missing the specific permission → **403** with no data leak (SC-007). Unknown ids → **404**.

## Reference

- Endpoint contracts: [contracts/api.md](./contracts/api.md)
- Entities, columns, indexes: [data-model.md](./data-model.md)
- Decisions & rationale: [research.md](./research.md)

> Implementation details (model/action/migration bodies, full test suites) live in `tasks.md` (via `/speckit-tasks`) and the implementation phase — not here.
