---
name: project-schema-conventions
description: Gym Platform DB conventions — naming, types, FK patterns, migration tooling, engine details
metadata:
  type: project
---

**Target engine**: MySQL 8.0 (production), SQLite in-memory (tests via phpunit.xml).
DDL is not transactional on MySQL — a crashed `down()` leaves schema and migration table
out of sync permanently. Always verify rollbacks on MySQL, not just SQLite.

**Naming conventions**:
- Plural snake_case tables, singular model names, `*_id` FKs.
- Exception: `payroll` table is intentionally singular/uncountable — documented as deliberate.
- Migration files timestamped; Phase 3 uses `2026_06_11_2005xx` prefix.

**Column types**:
- Money: `decimal(10,2)` — no float/double ever.
- Rates/fractions: `decimal(5,4)` (e.g. `0.1000` = 10%).
- Month periods: `char(7)` (`YYYY-MM`). No CHECK constraint currently — medium finding.
- Decimal defaults: use string form `->default('0.00')` not float `->default(0.00)`.
  Phase 1 subscriptions uses string form; Phase 3 employees used float (inconsistency flagged).

**FK on-delete patterns** (enforced by constitution):
- Financial history FKs (`commissions.employee_id`, `payroll.employee_id`): `restrictOnDelete`.
- Soft attribution / optional bridge FKs (`employees.user_id`, `expenses.created_by`,
  `subscriptions.sold_by_user_id`, `payments.created_by`): `nullOnDelete` with nullable column.
- Hard ownership FKs (`subscriptions.member_id`): `cascadeOnDelete`.
- Plan/product references: `restrictOnDelete` (can't delete a plan with active subscriptions).

**Index patterns**:
- `foreignId(...)->constrained()` in Laravel automatically creates a named FK-backing index
  `{table}_{column}_foreign`. Never try to re-create this index manually in a `down()` —
  MySQL will error with duplicate key name.
- `morphs('payable')` creates composite `{table}_payable_type_payable_id_index`.
- Additive index migrations use `dropIndex([...])` — prefer explicit string names over array
  convention to avoid silent mismatches if indexes are renamed.

**Recurring mistake to watch for**:
- `down()` methods in additive index migrations that re-add pre-existing FK-backing indexes
  before dropping the newly-added ones. This caused a BLOCKER in `200600_add_seller_indexes`
  (confirmed crash: "Duplicate key name 'sales_sold_by_user_id_index'").

**Migration tooling**: standard Laravel `artisan migrate` / `migrate:rollback`.
No Flyway, Liquibase, or custom harness.

**Morph map**: `commissions.source_type` / `source_id` uses manual string(150) + unsignedBigInteger
instead of `$table->morphs()`, with a unique constraint serving as the idempotency guard.
The unique `(source_type, source_id)` also covers morph lookups.

See [[migration-rollback-safety]] for the recurring down() pattern issue.
