# Phase 3 — Employees, Captains, Payroll, Commissions & Reports

---

## 1. Objective
Build HR + finance: employee/captain management, the **commission engine** (consuming subscriptions from Phase 1 and sales from Phase 2), payroll, full financial reports (revenue / expenses / net profit), per-employee performance, and the admin dashboards.

## 2. Scope
### In scope
- Employees/captains CRUD (link to users, base salary, commission rate).
- Commission engine (live on new sale/subscription **and** backfill for prior data).
- Expenses CRUD.
- Payroll generation (base + commissions + bonuses − deductions).
- Financial reports (revenue, expenses, net profit) by day/month/range.
- Per-employee performance reports.
- Full dashboard build-out (KPIs + charts + captain leaderboard).

### Out of scope (handled later)
- Final permission matrix + role-preset polish, full export, branding → Phase 4.

## 3. Prerequisites
- **Phase 0:** auth, permissions, audit, realtime, settings.
- **Phase 1:** `subscriptions`, `payments`, `sold_by_user_id`.
- **Phase 2:** `sales`, `sale_items`, `sold_by_user_id`, sale `payments`.

## 4. Deliverables
1. Employee/captain management with rates.
2. Commission engine producing accurate per-captain commissions from P1 + P2 data.
3. Payroll generation per employee per month.
4. Financial reports where revenue − expenses = net profit reconciles.
5. Live admin dashboard with KPIs, charts, and leaderboards.

## 5. Detailed Tasks

### 5.1 Backend
- **Employees:** model + CRUD; fields `user_id? (FK users, unique), name, phone, role[employee|captain|manager], base_salary, commission_rate, hire_date, status`.
  - **Link contract:** map historical `sold_by_user_id` (P1/P2) to employees via `employees.user_id`.
- **Commission engine** (Actions pattern):
  - `CalculateCommissionAction` — on a new subscription (P1) or sale (P2), resolve rate (employee-level or plan-level), create a `commissions` row (`source` morphs to Subscription|Sale, `month`, `amount`, `status[pending|paid]`).
  - `BackfillCommissionsCommand` — generate commissions for existing P1/P2 records.
- **Expenses:** CRUD (`category, amount, description, date, created_by`).
- **Payroll** (Actions pattern):
  - `GeneratePayrollAction` — per employee per month: `net = base_salary + Σ commissions + bonuses − deductions`; `status[pending|paid]`; marking paid writes an `expense` (or payment-out) for accounting consistency.
- **Financial reports:**
  - Revenue from **paid `payments`** (subscriptions + sales); expenses from `expenses` (+ paid payroll); net profit; grouped by day/month/range.
  - Per-employee performance: sales count, subscriptions sold, commissions earned, attendance (if used).
- **Dashboard summary endpoint:** active subscriptions, revenue MTD, expiring-soon, today's sales, top products, captain leaderboard.
- **Attendance (optional):** `attendance(employee_id, date, check_in, check_out, status, notes)`.
- **Permissions:** register `employees.*`, `commissions.*`, `payroll.*`, `expenses.*`, `reports.*`.
- **Audit:** `LogsActivity` on Employee, Commission, Payroll, Expense.
- **Performance hardening (critical here — reports are heavy):** prefer **JOINs over correlated subqueries**; add composite indexes (`subscriptions(status, end_date)`, `payments(payable_type, payable_id, status)`, `commissions(employee_id, month, status)`, `sales(created_at, sold_by_user_id)`); use **keyset/cursor pagination** instead of large `OFFSET`; cache expensive dashboard aggregates in Redis with sane TTL/invalidation.
- **Tests:** commission calc + backfill, payroll totals, revenue/net reconciliation.

### 5.2 Frontend
- `/employees` — list + create/edit + **profile** (commissions, performance).
- `/payroll` — generate month, review, mark paid, payslip view/export.
- `/expenses` — CRUD.
- `/reports` — financial (revenue/expenses/net with charts + range), per-employee performance.
- `/dashboard` — full build-out: KPI cards + Recharts charts + captain leaderboard.

## 6. Database (tables introduced / modified)
| Table | Key columns |
|---|---|
| `employees` | id, **user_id? (FK users)**, name, phone, role, base_salary, commission_rate, hire_date, status |
| `commissions` | id, employee_id, source_type, source_id (morphs), rate, amount, month, status[pending/paid] |
| `payroll` | id, employee_id, month, base_salary, commissions_total, bonuses, deductions, net_salary, status, paid_at |
| `expenses` | id, category, amount, description, date, created_by |
| `attendance` *(optional)* | id, employee_id, date, check_in, check_out, status, notes |

## 7. API Endpoints
| Method | Endpoint |
|---|---|
| GET / POST | `/employees` |
| PUT / DELETE | `/employees/{id}` |
| GET | `/employees/{id}/commissions?month=` |
| GET | `/employees/{id}/performance` |
| POST | `/commissions/backfill` |
| GET / POST | `/expenses` |
| POST | `/payroll/generate?month=` |
| GET | `/payroll?month=` · `/payroll/{id}/payslip` |
| POST | `/payroll/{id}/pay` |
| GET | `/reports/financial?from=&to=` |
| GET | `/reports/employees` |
| GET | `/dashboard/summary` |

## 8. Frontend Pages & Components
`/employees` (list + form + profile), `/payroll` (generate + payslip), `/expenses` (CRUD), `/reports` (financial + performance + charts), `/dashboard` (KPIs + charts + leaderboard).

## 9. Integration Contracts (exposed for later phases)
- **`employees.user_id` link** — resolves the `sold_by_user_id` captured in P1/P2.
- **Payroll/reports outputs** — **Phase 4** wires multi-format export for these.
- **Dashboard theme** — **Phase 4** applies final ATP branding tokens.
- **All HR/finance permissions** — folded into the **Phase 4** final permission matrix and role presets (esp. Accountant/Manager).

## 10. Acceptance Criteria (Definition of Done)
- [ ] Employee/captain CRUD with rates; `user_id` link works.
- [ ] Commission auto-created on new sale/subscription **and** backfilled for prior data; amounts correct.
- [ ] Payroll generation correct (base + commissions + adjustments).
- [ ] Financial report: revenue − expenses = net profit reconciles.
- [ ] Per-employee performance accurate.
- [ ] Dashboard KPIs/charts/leaderboard live.
- [ ] Permissions enforced across HR/finance modules.

## 11. Demo Checklist
Create a captain with a rate → a prior subscription/sale now shows a commission (backfill) → generate the month's payroll → financial report shows net profit → dashboard leaderboard ranks captains.

## 12. Notes
- **Commission rules** must be pinned down with the client (employee-level vs plan-level rate, whether product sales earn commission). Wrong rules → wrong payroll.
- This phase carries the heaviest queries — apply the performance hardening above to protect DB CPU.
- Reconcile carefully: revenue must tie back to **paid** payments only (not dues).
