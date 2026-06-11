# Database Schema Review — Phase 3: Employees, Payroll, Commissions & Reports

**Reviewer**: Database Schema Reviewer agent  
**Date**: 2026-06-11  
**Branch**: `004-employees-payroll-reports`  
**Target engine**: MySQL (production) / SQLite in-memory (tests)

---

## VERDICT: FAIL

One blocking defect was confirmed by live rollback execution: the `down()` method of
`2026_06_11_200600_add_seller_indexes.php` crashes MySQL with a duplicate key error,
leaving the database in a partially corrupted state. The rollback is irrecoverable
without manual intervention. Additionally, the `payments` table now carries a redundant
single-column `status` index that wastes write performance but does not block correctness.
The remaining six migrations are well-constructed and faithfully implement the data-model
spec.

---

## Summary

The new tables (`employees`, `commissions`, `payroll`, `expenses`) are correctly designed:
money columns use `decimal(10,2)`, rates use `decimal(5,4)`, `month` is `char(7)`,
financial-history FKs carry `restrictOnDelete`, the optional user bridge uses nullable
unique with `nullOnDelete`, and every business-critical unique constraint is present.
The additive column migration (`add_commission_rate_to_plans`) is clean. The two index
migrations (`add_revenue_indexes_to_payments`, `add_seller_indexes`) each have a defect
in their `down()` methods that makes rollback unsafe on MySQL.

---

## Findings

### BLOCKER

#### B-1 — `add_seller_indexes` `down()` crashes MySQL with a duplicate key error

**File**: `2026_06_11_200600_add_seller_indexes.php`

**Confirmed**: `php artisan migrate:rollback --step=1` raised:

```
SQLSTATE[42000]: Syntax error or access violation: 1061
Duplicate key name 'sales_sold_by_user_id_index'
```

**Root cause**: The `down()` method attempts to re-create a bare single-column index on
`sales.sold_by_user_id` before dropping the composite `(sold_by_user_id, created_at)`
index. On MySQL, `foreignId('sold_by_user_id')->constrained(...)` in the Phase 2 sales
migration automatically creates an FK-backing index named
`sales_sold_by_user_id_index`. That index was never removed, so the `down()` tries to
create a duplicate name and crashes before the `dropIndex` ever runs.

The subscriptions branch of `down()` has the same structural error: it tries to add
`subscriptions_sold_by_user_id_foreign_idx` before dropping the plain index, but since
the FK-backing index (`subscriptions_sold_by_user_id_foreign`) was present from Phase 1,
a name collision would also occur in many MySQL versions.

**Consequence**: The rollback aborts mid-transaction. Because MySQL DDL is not
transactional, `sales` loses the composite index without the migration record being
removed from the `migrations` table. The schema and migration state become permanently
inconsistent, requiring manual `ALTER TABLE` to recover.

**Fix**: The `down()` must only drop what `up()` added. Never re-create indexes that
predate this migration.

```php
public function down(): void
{
    Schema::table('sales', function (Blueprint $table): void {
        $table->dropIndex(['sold_by_user_id', 'created_at']); // drops sales_sold_by_user_id_created_at_index
    });

    Schema::table('subscriptions', function (Blueprint $table): void {
        $table->dropIndex(['sold_by_user_id']); // drops subscriptions_sold_by_user_id_index
    });
}
```

Do not touch any pre-existing FK-backing indexes. MySQL will not allow dropping an index
that backs an active foreign key constraint anyway; those indexes must only be removed
when the FK itself is dropped.

---

### HIGH

#### H-1 — `add_revenue_indexes_to_payments` `down()` uses implicit index-name resolution that is unreliable on MySQL

**File**: `2026_06_11_200500_add_revenue_indexes_to_payments_table.php`

```php
$table->dropIndex(['status', 'paid_at']);
$table->dropIndex(['payable_type', 'payable_id', 'status']);
```

Laravel's `dropIndex` with an array resolves the name as
`{table}_{columns}_index`. For the first call that yields
`payments_status_paid_at_index` — which is correct. For the second call it yields
`payments_payable_type_payable_id_status_index` — also technically correct.

However, `$table->morphs('payable')` in the Phase 1 payments migration created
`payments_payable_type_payable_id_index`. Phase 3's `up()` now adds
`payments_payable_type_payable_id_status_index`. These are different indexes. That is
fine, but the `down()` must drop the right one. The current implicit-name approach works
here IF the index was created with the default Laravel naming convention — but it creates
a subtle maintenance trap if an index is ever renamed.

More concretely: the `payments` table currently has **both** `payments_status_index`
(from Phase 1's single `->index()` on `status`) **and** `payments_status_paid_at_index`
(from Phase 3). The single-column `status` index is now a leading-prefix redundant subset
of the composite `(status, paid_at)` index. MySQL will still maintain both, wasting write
throughput. This redundant index is not introduced by Phase 3 (it came from Phase 1), but
Phase 3 should document the awareness or Phase 1 should have that index removed.

**Fix for `down()` robustness**: use explicit index names.

```php
public function down(): void
{
    Schema::table('payments', function (Blueprint $table): void {
        $table->dropIndex('payments_status_paid_at_index');
        $table->dropIndex('payments_payable_type_payable_id_status_index');
    });
}
```

**Fix for redundant `status` index**: in a follow-up migration (or in Phase 1 cleanup),
drop `payments_status_index` since `(status, paid_at)` fully covers single-column status
lookups as the leading key.

---

### MEDIUM

#### M-1 — `commissions.source_type` / `source_id` morphs bypass `nullableMorphs` but the morph type string is unbounded in practice

**File**: `2026_06_11_200100_create_commissions_table.php`

The migration declares `source_type` as `string('source_type', 150)`. Laravel's
`morphs()` helper uses `string` (which maps to `varchar(255)`) with an accompanying
index. The manual equivalent here uses 150 characters — adequate for current
morph map entries (`App\Models\Subscription`, `App\Models\Sale`, both well under 150) but
not future-proof if the morph map is ever not enforced.

More importantly, the manual declaration bypasses `$table->morphs()`/`nullableMorphs()`
which would register the proper composite morph index. The unique constraint
`(source_type, source_id)` already serves as the idempotency index and implicitly covers
morph lookups, so there is no functional gap — but future reviewers may not realise this
is intentional.

**Recommendation**: Add a comment explaining the design decision, or use an explicit morph
map (`Relation::enforceMorphMap`) and document that 150 chars is sufficient.

---

#### M-2 — `payroll` table name is intentionally singular; this is inconsistent with the convention

**File**: `2026_06_11_200200_create_payroll_table.php`

The CLAUDE.md and constitution both require **plural snake_case** table names. `payroll`
is grammatically both singular and plural (an uncountable noun), and the spec acknowledges
this is intentional. It is not a true violation but it should be explicitly flagged and
documented in the migration as a deliberate exception so future reviewers do not raise it.

**Recommendation**: Add a comment in the migration:

```php
// Table name 'payroll' is intentionally used as the plural/collective form
// (the word is uncountable in English). Matches the model class Payroll.
```

---

#### M-3 — `commissions.month` and `payroll.month` have no CHECK constraint to enforce YYYY-MM format

**File**: `2026_06_11_200100_create_commissions_table.php`, `2026_06_11_200200_create_payroll_table.php`

`char(7)` stores the right width, but any 7-character string is accepted. MySQL 8.0+
supports `CHECK` constraints natively.

**Recommendation**:

```php
$table->char('month', 7);
// Add after the column definition:
DB::statement("ALTER TABLE commissions ADD CONSTRAINT chk_commissions_month CHECK (month REGEXP '^[0-9]{4}-[0-9]{2}$')");
```

This is medium rather than high because application-layer validation (Form Request) is the
primary guard and these columns are only written by internal Actions — but defense-in-depth
at the DB layer is better practice for financial data.

---

#### M-4 — `employees.commission_rate` default is `0.0000` stored as a PHP float literal

**File**: `2026_06_11_200000_create_employees_table.php`

```php
$table->decimal('commission_rate', 5, 4)->default(0.0000);
```

PHP will coerce `0.0000` to the float `0.0` before passing it to the schema builder. For
most drivers this is safe because the driver will convert it back, but it is cleaner and
explicit to use a string:

```php
$table->decimal('commission_rate', 5, 4)->default('0.0000');
```

The Phase 1 `subscriptions` migration already uses `->default('0.00')` (string) for
`discount`. Align with that existing convention.

---

### NITPICK

#### N-1 — Inline comment in `add_seller_indexes` `down()` describes logic that was incorrect

**File**: `2026_06_11_200600_add_seller_indexes.php`

The removed `down()` code contained comments like:
> "We can drop it, but if it's the foreign key index, MySQL might complain too."

This comment was exactly right — the index drop does conflict with MySQL's FK constraint,
and the original implementation added back indexes to work around this. The fix in B-1
above handles it correctly. Once the fix is applied, any vestigial comments about the
workaround should be removed.

---

#### N-2 — `add_revenue_indexes_to_payments` does not add index on `paid_at` alone

The financial report aggregates `SUM(payments.amount WHERE status='paid')` grouped by
`paid_at` bucket. The composite `(status, paid_at)` index covers the filter + sort.
The single-column `paid_at` index from Phase 1's `->nullable()->index()` on `due_date`
is separate. This is fine — no additional index needed — but worth noting that
`paid_at` is only indexed as a trailing column in the composite, so range scans purely
on `paid_at` without a `status` filter would perform a full-table scan. If future reports
need date-only queries, add `$table->index('paid_at')`.

---

## Migration Table

| Migration | Tables affected | New columns | New FKs (on delete) | New indexes | `down()` safe? |
|---|---|---|---|---|---|
| `200000_create_employees_table` | `employees` (create) | 9 cols + timestamps | `user_id→users` (nullOnDelete) | unique(`user_id`), `role`, `status` | Yes — `dropIfExists` |
| `200100_create_commissions_table` | `commissions` (create) | 8 cols + timestamps | `employee_id→employees` (restrictOnDelete) | unique(`source_type`,`source_id`), composite(`employee_id`,`month`,`status`) | Yes — `dropIfExists` |
| `200200_create_payroll_table` | `payroll` (create) | 9 cols + timestamps | `employee_id→employees` (restrictOnDelete) | unique(`employee_id`,`month`), composite(`month`,`status`) | Yes — `dropIfExists` |
| `200300_create_expenses_table` | `expenses` (create) | 6 cols + timestamps | `created_by→users` (nullOnDelete) | `category`, `date` | Yes — `dropIfExists` |
| `200400_add_commission_rate_to_plans` | `plans` (alter) | `commission_rate decimal(5,4) nullable` | none | none | Yes — `dropColumn` |
| `200500_add_revenue_indexes_to_payments` | `payments` (alter) | none | none | `(status,paid_at)`, `(payable_type,payable_id,status)` | Mostly — implicit name resolution (H-1) |
| `200600_add_seller_indexes` | `sales`, `subscriptions` (alter) | none | none | `(sold_by_user_id,created_at)` on sales, `(sold_by_user_id)` on subscriptions | **NO** — crashes MySQL (B-1) |

---

## What Was Done Well

- Financial FK discipline is correct: `commissions.employee_id` and `payroll.employee_id`
  both carry `restrictOnDelete`, preventing deletion of employees with financial history.
- `employees.user_id` is correctly nullable + unique with `nullOnDelete`, matching the
  spec's bridge-column intent exactly.
- `expenses.created_by` is nullable with `nullOnDelete`, correct for a soft attribution
  column.
- All money columns are `decimal(10,2)` with no float/double. Rate columns are
  `decimal(5,4)`. `month` is `char(7)`. No type deviations from the spec.
- The `commissions` unique `(source_type, source_id)` enforces idempotency at the DB
  level — the right place for it.
- The `payroll` unique `(employee_id, month)` correctly prevents double-generation (FR-015).
- The additive index migrations touch no column data and are therefore zero-downtime on
  both MySQL 8.0 (online DDL) and PostgreSQL (if ever migrated) without needing
  `ALGORITHM=INPLACE` hints in this context.
- The `add_commission_rate_to_plans` migration correctly uses `->after('price')` for
  column positioning and provides a clean `dropColumn` rollback.

---

## Required Actions Before Merge

1. **Fix `200600_add_seller_indexes` `down()`** (B-1) — replace with the corrected
   implementation shown above. Verify with `migrate:rollback --step=1` on a clean MySQL
   database. The current database is in a partially inconsistent state from the crashed
   rollback; run `ALTER TABLE sales DROP INDEX sales_sold_by_user_id_index` manually to
   restore a clean baseline before the fix is tested again.

2. **Harden `200500_add_revenue_indexes_to_payments` `down()`** (H-1) — use explicit
   index name strings in `dropIndex()` calls.

3. **Optional but recommended**: Add string defaults for decimal columns (M-4), add
   `char(7)` CHECK constraints for `month` columns (M-3), and add the `payroll` naming
   comment (M-2).
