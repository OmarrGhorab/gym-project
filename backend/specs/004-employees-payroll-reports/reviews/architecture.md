# Architecture Review — 004 Employees, Payroll, Commissions & Reports

**Date:** 2026-06-11
**Reviewer:** laravel-architecture-reviewer
**Feature:** 004-employees-payroll-reports
**Deliverable:** T002

## Verdict: APPROVED

The architecture is sound, fully compliant with the Constitution, and follows clean Laravel conventions. The split between controllers, form requests, policies, actions, and API resources matches the established structure of the project.

---

## Constitution Compliance

The plan complies with the project Constitution on all points:
- **Laravel-First**: Utilizes Spatie permissions, Spatie activity logs, Form Requests, Policies, and Eloquent models natively.
- **Thin Transport**: All business logic (Commission calculation, Payroll generation, Paying payroll) is isolated in Action classes.
- **Test-First with Pest**: Failing feature and unit tests will be written before any implementation code.
- **Versioned Contract**: All endpoints are prefixed under `/api/v1` and return standard success/error envelopes.
- **Security by Default**: Models specify explicit `$fillable` fields, and policies gate all non-public endpoints.
- **Performance**: Eager loading is configured in the API resources, and database indexes are added to optimize revenue and attribution queries.
- **YAGNI**: No speculative abstractions or repository patterns are introduced.

---

## Risks & Mitigations

### R1 — Database-level Locking Compatibility with SQLite (Medium)
The use of `lockForUpdate()` during concurrency checks on SQLite (used for the test suite) can trigger compatibility warnings or fail to execute locks.
- *Mitigation*: Ensure logic utilizes robust Laravel database transactions and checks that are fully compatible with both SQLite and MySQL.

### R2 — Change Precedence on Salaries and Rates (Low)
Changing an employee's salary or rate must not alter already calculated payroll or commissions.
- *Mitigation*: The database schema stores snapshots of the rate and base salary in the `commissions` and `payroll` tables respectively. All recalculations are limited to pending records.

---

## Refactoring Suggestions

Ensure that commission trigger observers are clean, using `DB::afterCommit` inside observer methods to avoid executing heavy calculation queries during database transaction boundaries of sales/subscriptions.

---

## Conditions for Approval

1. **Transaction Snapshotting**: The `commissions` table must capture the applied `rate` and `amount` snapshots at creation.
2. **Idempotent Backfill**: The backfill Artisan command must execute with unique constraints to prevent double-crediting.
