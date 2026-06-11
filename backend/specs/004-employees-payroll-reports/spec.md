# Feature Specification: Employees, Payroll, Commissions & Reports

**Feature Branch**: `004-employees-payroll-reports`

**Created**: 2026-06-11

**Status**: Draft

**Input**: Phase 3 — Employees, Captains, Payroll, Commissions & Reports (HR + finance for the gym platform)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Employee & Captain Management (Priority: P1)

A gym administrator maintains the staff roster — adding employees, captains, and managers with their base salary, commission rate, hire date, and status. Each staff member can optionally be linked to an existing platform user account so the work they have already performed (subscriptions sold, POS sales rung) can be attributed to them for commissions and performance.

**Why this priority**: Every other capability in this phase — commissions, payroll, performance reports, the captain leaderboard — depends on an accurate employee roster and the link between an employee and their user account. Without it, none of the finance or HR features have subjects to operate on.

**Independent Test**: Can be fully tested by creating, editing, deactivating, and listing employees with all fields, and by linking an employee to a user account and confirming the link is enforced as unique — all without touching commissions or payroll.

**Acceptance Scenarios**:

1. **Given** I am an authorized administrator, **When** I create an employee with name, phone, role (employee/captain/manager), base salary, commission rate, hire date, and status, **Then** the employee appears in the roster with all fields correct.
2. **Given** an employee exists, **When** I update their base salary or commission rate, **Then** the change is reflected immediately and does not retroactively alter already-recorded commissions.
3. **Given** a platform user account exists, **When** I link it to an employee, **Then** the employee is associated with that user and the same user cannot be linked to a second employee.
4. **Given** an employee is no longer active, **When** I set their status to inactive, **Then** they remain in the roster for historical records but are excluded from new payroll generation.
5. **Given** I view an employee's profile, **When** the profile loads, **Then** it shows their details together with their commissions and performance summary.

---

### User Story 2 - Commission Engine (Live + Backfill) (Priority: P1)

When a captain sells a subscription (Phase 1) or rings a qualifying sale (Phase 2), the system automatically calculates and records a commission attributed to the corresponding employee. For staff and transactions that predate this phase, an administrator runs a one-time backfill that generates the missing commissions from existing subscription and sale data.

**Why this priority**: The commission engine is the heart of this phase — it converts raw transaction data into the per-captain earnings that drive payroll and the leaderboard. It is the deliverable most likely to be wrong if rules are unclear, so it must be correct and independently verifiable.

**Independent Test**: Can be fully tested by configuring a captain's rate, recording a new subscription/sale attributed to that captain's user, and asserting a commission row with the correct amount, month, and source; then running the backfill over seeded historical data and asserting commissions are generated exactly once with correct amounts.

**Acceptance Scenarios**:

1. **Given** a captain with a commission rate and a linked user, **When** a new subscription is created with that user as the seller, **Then** a commission is created referencing the subscription, for the subscription's month, with `amount = base × rate` and status pending.
2. **Given** a captain with a linked user, **When** a new sale is completed with that user as the seller, **Then** a commission is created referencing the sale, for the sale's month, with the correct amount and status pending.
3. **Given** historical subscriptions and sales exist with no commissions, **When** an administrator runs the backfill, **Then** commissions are generated for all qualifying historical records attributed to a linked employee.
4. **Given** the backfill has already run, **When** it is run again, **Then** no duplicate commissions are created for records that already have one.
5. **Given** a transaction whose seller user is not linked to any employee, **When** commission calculation runs, **Then** no commission is created and the skip is recorded for observability.
6. **Given** a commission already marked paid, **When** the source transaction is later voided or refunded, **Then** the system flags the discrepancy rather than silently deleting a paid commission.

---

### User Story 3 - Payroll Generation (Priority: P1)

An administrator generates payroll for a given month. For each active employee, the system computes net pay as base salary plus the sum of that month's commissions plus bonuses minus deductions, and records a payroll entry the administrator can review, adjust, and mark paid. Marking a payroll paid records the corresponding expense so the books stay consistent.

**Why this priority**: Payroll is the primary business outcome of the HR side — staff must be paid correctly and the payment must flow into the financial picture. It depends directly on employees (US1) and commissions (US2).

**Independent Test**: Can be fully tested by seeding an employee with a base salary and a set of commissions for a month, generating payroll, and asserting the net total equals base + commissions + bonuses − deductions; then marking it paid and asserting an expense (payout) is recorded.

**Acceptance Scenarios**:

1. **Given** an active employee with a base salary and three pending commissions in a month, **When** payroll is generated for that month, **Then** a payroll entry is created with base salary, the summed commissions total, zero bonuses/deductions by default, and a net equal to base + commissions.
2. **Given** a generated payroll entry, **When** the administrator adds a bonus and a deduction, **Then** the net recomputes to base + commissions + bonuses − deductions.
3. **Given** a payroll entry, **When** the administrator marks it paid, **Then** its status becomes paid with a paid timestamp, the commissions it included are marked paid, and a corresponding expense (payout) is recorded for the month.
4. **Given** payroll has already been generated for a month, **When** generation is run again for the same month, **Then** the system does not create duplicate payroll entries for employees already processed.
5. **Given** a payroll entry, **When** the administrator requests the payslip, **Then** a payslip is produced showing base salary, itemized commissions, bonuses, deductions, and net pay.

---

### User Story 4 - Expense Tracking (Priority: P2)

A manager records operational expenses (rent, utilities, equipment, salaries paid, etc.) with a category, amount, description, and date, and reviews them over time. These expenses feed the financial reports.

**Why this priority**: Expenses are required for the net-profit calculation in the financial report, but the report (US5) is the consumer of value. Expense CRUD is a supporting capability.

**Independent Test**: Can be fully tested by creating, editing, listing, and deleting expenses and verifying each is attributed to the creating user and dated correctly — independently of reports.

**Acceptance Scenarios**:

1. **Given** I am an authorized manager, **When** I record an expense with category, amount, description, and date, **Then** the expense is saved and attributed to me as creator.
2. **Given** expenses exist, **When** I list them filtered by date range or category, **Then** only matching expenses are returned.
3. **Given** a payroll entry is marked paid, **When** the resulting payout is recorded, **Then** it appears as an expense so total expenses include paid salaries.

---

### User Story 5 - Financial Reports (Priority: P2)

A manager or accountant reviews financial reports for a chosen day, month, or date range: total revenue from paid payments (subscriptions + sales), total expenses, and the resulting net profit. The figures reconcile — revenue minus expenses equals net profit.

**Why this priority**: Financial visibility is a core business outcome of the phase, but it is a read-only aggregation that depends on commissions, payroll/expenses, and the existing payments data being in place first.

**Independent Test**: Can be fully tested by seeding paid payments and expenses across known dates and asserting that the report's revenue, expense, and net-profit figures reconcile exactly for day, month, and arbitrary-range groupings.

**Acceptance Scenarios**:

1. **Given** paid subscription and sale payments and recorded expenses for a period, **When** the financial report is requested for that period, **Then** revenue equals the sum of paid payments, expenses equals the sum of recorded expenses, and net profit equals revenue minus expenses.
2. **Given** payments with a non-paid status (partial/due), **When** the report is computed, **Then** only paid amounts contribute to revenue.
3. **Given** a date range spanning multiple months, **When** the report is grouped by month, **Then** each month shows its own revenue, expenses, and net profit, and the totals sum to the range total.

---

### User Story 6 - Per-Employee Performance Reports (Priority: P2)

A manager reviews each employee's performance for a period: number of sales rung, subscriptions sold, and commissions earned, so they can evaluate and reward staff.

**Why this priority**: Performance insight supports HR decisions and the leaderboard, but it is a read-only aggregation derived from the same data as commissions; it follows the core engine.

**Independent Test**: Can be fully tested by seeding subscriptions, sales, and commissions for several employees and asserting each employee's counts and commission totals are accurate for the period.

**Acceptance Scenarios**:

1. **Given** an employee with sales and subscriptions in a period, **When** the performance report is requested, **Then** it shows their sales count, subscriptions-sold count, and total commissions earned for that period.
2. **Given** multiple employees, **When** the performance report is requested, **Then** each employee's figures are independent and attributed only to their linked user's transactions.

---

### User Story 7 - Admin Dashboard Summary (Priority: P3)

A manager opens the dashboard and immediately sees the key health indicators of the business: active subscriptions, revenue month-to-date, subscriptions expiring soon, today's sales, top products, and a captain leaderboard ranked by commissions earned.

**Why this priority**: The dashboard is a high-value informational overlay, but it depends on all the underlying aggregations (revenue, commissions, sales) being in place. It is delivered last and can be demonstrated independently once its data sources exist.

**Independent Test**: Can be fully tested by seeding the underlying data and asserting the summary endpoint returns each KPI and a correctly ranked captain leaderboard.

**Acceptance Scenarios**:

1. **Given** active subscriptions, paid payments this month, and sales today, **When** the dashboard summary is requested, **Then** it returns active-subscription count, revenue MTD, expiring-soon count, today's sales total, and top products.
2. **Given** captains with commissions in the current month, **When** the dashboard is requested, **Then** the leaderboard ranks captains by total commissions earned, highest first.
3. **Given** the dashboard is requested repeatedly within a short window, **When** the aggregates have not changed, **Then** responses are served from cache and remain consistent.

---

### Edge Cases

- What happens when a transaction's seller user is not linked to any employee? No commission is created; the skip is recorded for observability.
- What happens when an employee's commission rate is changed after commissions were already recorded? Existing commissions are unaffected; only future transactions use the new rate.
- What happens when the backfill is run more than once? It is idempotent — already-commissioned records are skipped, never duplicated.
- What happens when payroll generation is re-run for a month already processed? Employees already having a payroll entry for that month are not duplicated.
- What happens when a source transaction is voided/refunded after its commission was marked paid? The system surfaces the discrepancy for reconciliation rather than silently mutating a paid record.
- What happens when net pay would be negative (deductions exceed base + commissions + bonuses)? The system rejects or flags the payroll entry rather than recording a negative payout.
- What happens when a report is requested for a period with no data? Zeroed totals are returned, not an error.
- What happens when two administrators generate payroll for the same month concurrently? The system prevents duplicate payroll entries per employee per month.
- What happens when an employee linked to a user is deleted? Historical commissions and payroll remain intact and attributable.

## Requirements *(mandatory)*

### Functional Requirements

**Employees & Captains**

- **FR-001**: The system MUST allow authorized users to create, read, update, and list employees with name, phone, role (employee/captain/manager), base salary, commission rate, hire date, and status.
- **FR-002**: The system MUST allow an employee to be optionally linked to exactly one platform user account, and MUST prevent the same user from being linked to more than one employee.
- **FR-003**: The system MUST allow an employee to be deactivated (status change) without deletion, excluding inactive employees from new payroll generation while preserving their historical records.
- **FR-004**: The system MUST expose an employee profile that aggregates the employee's details, their commissions (filterable by month), and their performance summary.
- **FR-005**: Changing an employee's base salary or commission rate MUST NOT retroactively alter commissions or payroll already recorded.

**Commission Engine**

- **FR-006**: The system MUST automatically create a commission when a new subscription (Phase 1) is recorded whose seller user is linked to a commission-eligible employee.
- **FR-007**: The system MUST automatically create a commission when a new sale (Phase 2) is recorded whose seller user is linked to a commission-eligible employee. Both subscription sales (FR-006) and POS/product sales earn commission.
- **FR-008**: The system MUST resolve the commission rate for a transaction using this precedence: a plan-level (or product-level) commission rate, when set on the source, overrides the employee's default `commission_rate`; otherwise the employee's `commission_rate` applies.
- **FR-009**: Each commission MUST record the source transaction (polymorphic to Subscription or Sale), the rate applied, the computed amount, the month it belongs to, and a status of pending or paid.
- **FR-010**: The system MUST provide a backfill operation that generates commissions for existing historical subscriptions and sales attributed to linked employees.
- **FR-011**: The backfill MUST be idempotent — running it multiple times MUST NOT create duplicate commissions for a source that already has one.
- **FR-012**: When a transaction's seller user is not linked to any employee, the system MUST NOT create a commission and MUST record the skip for observability.
- **FR-013**: The system MUST allow retrieval of an employee's commissions filtered by month.

**Payroll**

- **FR-014**: The system MUST generate payroll per active employee per month, computing `net = base_salary + Σ commissions(month) + bonuses − deductions`.
- **FR-015**: Payroll generation MUST NOT create duplicate entries for an employee already having a payroll entry for the same month.
- **FR-016**: The system MUST allow authorized users to adjust bonuses and deductions on a payroll entry before it is paid, recomputing the net accordingly.
- **FR-017**: The system MUST reject or flag a payroll entry whose net pay would be negative.
- **FR-018**: Marking a payroll entry paid MUST set its status to paid with a timestamp, mark the included commissions as paid, and record a corresponding expense (payout) for accounting consistency.
- **FR-019**: The system MUST produce a payslip for a payroll entry showing base salary, itemized commissions, bonuses, deductions, and net pay.
- **FR-020**: The system MUST list payroll entries filterable by month.

**Expenses**

- **FR-021**: The system MUST allow authorized users to create, read, update, list, and delete expenses with category, amount, description, date, and the creating user.
- **FR-022**: The system MUST allow expenses to be filtered by date range and category.

**Financial Reports**

- **FR-023**: The system MUST compute revenue as the sum of **paid** payments only (subscriptions + sales); partial and due amounts MUST NOT contribute to revenue.
- **FR-024**: The system MUST compute total expenses from recorded expenses, including payouts written when payroll is marked paid.
- **FR-025**: The system MUST compute net profit as revenue minus expenses, and the three figures MUST reconcile exactly for any requested period.
- **FR-026**: The system MUST support financial reports grouped by day, by month, and over an arbitrary date range.

**Performance Reports**

- **FR-027**: The system MUST produce a per-employee performance report for a period showing sales count, subscriptions-sold count, and commissions earned, attributed only to the employee's linked user.

**Dashboard**

- **FR-028**: The system MUST provide a dashboard summary returning active-subscription count, revenue month-to-date, expiring-soon count, today's sales total, top products, and a captain leaderboard ranked by commissions earned.
- **FR-029**: The dashboard's expensive aggregates MUST be cached with an intentional TTL and invalidated when underlying data changes.

**Permissions & Audit**

- **FR-030**: The system MUST register and enforce distinct permissions for `employees.*`, `commissions.*`, `payroll.*`, `expenses.*`, and `reports.*`, and every non-public endpoint MUST be authenticated and policy-gated.
- **FR-031**: The system MUST record an audit log entry for create/update/delete on employees, commissions, payroll, and expenses, and for marking payroll paid.

### Key Entities

- **Employee**: A staff member (employee, captain, or manager) with name, phone, role, base salary, commission rate, hire date, and status, optionally linked to one platform user account. The link is the bridge that attributes Phase 1/2 transactions (`sold_by_user_id`) to the employee.
- **Commission**: An earning attributed to an employee, polymorphically referencing its source (Subscription or Sale), recording the rate applied, the amount, the month, and a pending/paid status.
- **Payroll**: A monthly compensation record per employee capturing base salary, total commissions, bonuses, deductions, computed net salary, status (pending/paid), and paid timestamp.
- **Expense**: An operational cost with category, amount, description, date, and creating user; salary payouts are recorded here when payroll is paid.
- **Payment** *(reused from Phase 1/2)*: The single source of revenue truth; the financial report reads paid payments across subscriptions and sales. No schema changes.
- **Subscription / Sale** *(consumed from Phase 1/2)*: The commission sources, attributed via `sold_by_user_id` → `employees.user_id`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A commission is automatically and correctly recorded for every new commission-eligible subscription/sale attributed to a linked employee, with a computed amount that matches base × resolved rate.
- **SC-002**: Running the backfill over historical data produces exactly one commission per qualifying record, and re-running it produces zero additional commissions (idempotent).
- **SC-003**: For any month, a generated payroll entry's net pay equals base salary + summed commissions + bonuses − deductions for 100% of employees, with zero arithmetic discrepancy.
- **SC-004**: For any requested period, revenue − expenses = net profit reconciles exactly (zero discrepancy), and only paid payments contribute to revenue.
- **SC-005**: Per-employee performance figures (sales count, subscriptions sold, commissions earned) match the underlying seeded data exactly for the period.
- **SC-006**: The captain leaderboard ranks captains by commissions earned in the correct order for the selected period.
- **SC-007**: All HR/finance endpoints enforce permission checks — unauthorized access returns 403 with no data leakage.
- **SC-008**: The dashboard summary endpoint returns within an acceptable latency under realistic data volumes by serving cached aggregates, and reflects underlying changes after cache invalidation.
- **SC-009**: Marking a payroll paid results in a matching expense payout such that total expenses always include all paid salaries with zero double-counting.

## Assumptions

- Phase 0 (auth, roles/permissions, audit/activity log, settings, realtime) and Phases 1–2 (`subscriptions`, `sales`, `sale_items`, polymorphic `payments` with paid/partial/due status, `sold_by_user_id` referencing `users`) are fully deployed and are hard prerequisites.
- The link between staff and transactions is `employees.user_id` → `users.id`; the historical `sold_by_user_id` on subscriptions and sales is resolved through this link. No change to `sold_by_user_id` is required.
- Commission base is the transaction's monetary value (subscription price / sale total). Both subscription sales and POS/product sales are commission-eligible.
- Commission rate resolution: a plan-level or product-level rate, when present on the source, overrides the employee's default `commission_rate`; otherwise the employee's `commission_rate` is used.
- Only employees with role `captain` (and any explicitly commission-eligible role) earn commissions by default; pure `manager`/`employee` roles without a rate earn none.
- Payroll is generated per calendar month; partial-month proration is out of scope for this phase (full base salary per processed month).
- Marking payroll paid is the single mechanism that converts staff cost into an expense; there is no separate payout ledger — the existing `expenses` table is the payout record.
- The `month` dimension on commissions and payroll is derived from the source transaction date / target month respectively and stored explicitly for fast grouping.
- Attendance is treated as **optional and out of scope** for this phase; the performance report excludes attendance metrics unless added later. This keeps scope bounded.
- Reports default to the current day/month when no range is supplied; large result sets use keyset/cursor pagination rather than large offsets.
- Dashboard aggregates are cached in the configured cache store with a short TTL and explicit invalidation on relevant write events; exact TTL is an implementation tuning detail.
- Multi-format export (PDF/Excel) and final branding for payslips and reports are deferred to Phase 4; this phase exposes the data and a basic payslip/report view.
- All monetary values use the platform's existing currency/precision conventions from the `settings` table established in Phase 0.
