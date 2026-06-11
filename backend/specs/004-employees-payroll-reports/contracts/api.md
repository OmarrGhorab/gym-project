# API Contracts — Phase 3: Employees, Payroll, Commissions & Reports

All routes are under `/api/v1`, require `auth:sanctum`, and are permission-gated. Success envelope `{ data, meta, message }`; error envelope `{ error: { code, message, details } }`. Money returned as `"0.00"` strings; `rate` as a decimal string; `month` as `YYYY-MM`. Lists use cursor pagination (`meta.next_cursor`) consistent with Phase 2.

Permissions: `HrFinancePermissions` (`employees.*`, `commissions.*`, `payroll.*`, `expenses.*`) + reused `reports.view`. Write-heavy endpoints (`backfill`, `payroll/generate`) carry `throttle`.

---

## Employees

### `GET /employees` — `employees.view`
List employees. Filterable: `role`, `status`, `q` (name/phone). Cursor-paginated.
- **200** `data: EmployeeResource[]`, `meta.next_cursor`.

### `POST /employees` — `employees.create`
Body: `name*`, `phone?`, `role*` (`employee|captain|manager`), `base_salary?` (≥0), `commission_rate?` (0–9.9999), `hire_date?`, `status?`, `user_id?`.
- **201** `data: EmployeeResource`.
- **422** invalid role/rate, or `user_id` already linked to another employee (unique) / not a real user.

### `GET /employees/{id}` — `employees.view`
- **200** `data: EmployeeResource` (profile: includes `commissions_summary`, `performance_summary` when loaded). **404** unknown id.

### `PUT /employees/{id}` — `employees.update`
Body: any of `name, phone, role, base_salary, commission_rate, hire_date, status, user_id`.
- **200** `data: EmployeeResource`. **422** uniqueness/validation. Rate/salary changes do **not** alter recorded commissions/payroll.

### `DELETE /employees/{id}` — `employees.delete`
- **204** when no dependent commissions/payroll. **409/422** when financial history exists (restrict).

### `GET /employees/{id}/commissions?month=YYYY-MM` — `commissions.view`
Employee's commissions, optional `month` filter. Cursor-paginated.
- **200** `data: CommissionResource[]`, `meta` (incl. `total_amount` for the filter). **404** unknown employee.

### `GET /employees/{id}/performance?from=&to=` — `reports.view`
- **200** `data: { sales_count, subscriptions_count, commissions_earned, period }`. Defaults to current month when range omitted.

---

## Commissions

### `POST /commissions/backfill` — `commissions.backfill` (throttled)
Generates commissions for historical subscriptions + sales attributed to a linked employee. Idempotent. Body (optional): `from?`, `to?`, `dry_run?`.
- **202/200** `data: { created, skipped_unlinked, already_present, scanned }`. Re-running yields `created: 0`.

> The **live** path (observers) needs no endpoint — commissions appear automatically when a subscription/sale is created by a linked employee.

---

## Payroll

### `POST /payroll/generate?month=YYYY-MM` — `payroll.generate` (throttled)
Generates payroll for all active employees for `month`. Idempotent per `(employee_id, month)`.
- **200/201** `data: PayrollResource[]`, `meta: { month, generated, skipped_existing }`. **422** bad month format.

### `GET /payroll?month=YYYY-MM` — `payroll.view`
List payroll entries (optional `month`, `status`, `employee_id`). Cursor-paginated.
- **200** `data: PayrollResource[]`.

### `PUT /payroll/{id}` — `payroll.update` *(reuses `payroll.generate` if `update` not seeded)*
Adjust `bonuses?`, `deductions?` while `pending`. Recomputes `net_salary`.
- **200** `data: PayrollResource`. **422** negative net, or entry already `paid`.

### `POST /payroll/{id}/pay` — `payroll.pay`
Atomic: `status=paid`, `paid_at`, included commissions → `paid`, expense payout (`category=payroll`) written.
- **200** `data: PayrollResource`. **409/422** already paid or net invalid.

### `GET /payroll/{id}/payslip` — `payroll.view`
- **200** `data: PayslipResource` (JSON) or PDF stream on `Accept: application/pdf` (dompdf). Shows base, itemized commissions, bonuses, deductions, net.

---

## Expenses

### `GET /expenses?from=&to=&category=` — `expenses.view`
Cursor-paginated, filterable by date range + category.
- **200** `data: ExpenseResource[]`, `meta` (incl. `total_amount`).

### `POST /expenses` — `expenses.create`
Body: `category*`, `amount*` (>0), `description?`, `date*`.
- **201** `data: ExpenseResource` (attributed to caller as `created_by`).

### `PUT /expenses/{id}` — `expenses.update` · `DELETE /expenses/{id}` — `expenses.delete`
- **200 / 204**. **404** unknown id.

---

## Reports

### `GET /reports/financial?from=&to=&group_by=day|month` — `reports.view`
Revenue (paid payments) − expenses = net profit, grouped.
- **200** `data: [{ period, revenue, expenses, net_profit }]`, `meta: { from, to, group_by, totals: { revenue, expenses, net_profit } }`. Empty period → zeros, not error. Totals reconcile exactly (SC-004).

### `GET /reports/employees?from=&to=` — `reports.view`
Per-employee performance across the range.
- **200** `data: [{ employee_id, name, role, sales_count, subscriptions_count, commissions_earned }]`. Cursor-paginated if large.

---

## Dashboard

### `GET /dashboard/summary` — `reports.view` (or `dashboard.view`)
Single cached aggregate (Redis, ~60s TTL, invalidated on commission/sale writes).
- **200** `data: { active_subscriptions, revenue_mtd, expiring_soon, sales_today: { count, revenue }, top_products: [...], captain_leaderboard: [{ employee_id, name, commissions_total }] }`.

---

## Resource shapes (response contracts)

```text
EmployeeResource     { id, name, phone, role, base_salary, commission_rate,
                       hire_date, status, user: UserSummary|null,
                       commissions_summary?, performance_summary?, created_at }
CommissionResource   { id, employee_id, source: { type, id }, rate, amount,
                       month, status, created_at }
PayrollResource      { id, employee: {id,name,role}, month, base_salary,
                       commissions_total, bonuses, deductions, net_salary,
                       status, paid_at }
PayslipResource      { employee, month, base_salary, commissions: [...],
                       bonuses, deductions, net_salary, generated_at }
ExpenseResource      { id, category, amount, description, date,
                       created_by: UserSummary, created_at }
```

## Status-code conventions (consistent with Phases 1–2)

`200` read/update · `201` create · `204` delete · `401` unauthenticated · `403` permission denied · `404` not found · `409`/`422` business-rule/validation (already paid, net<0, unique link, restrict-on-delete) · `429` throttled.
