# Architecture Review — 003 POS, Products & Inventory

**Date:** 2026-06-11
**Reviewer:** laravel-architecture-reviewer
**Feature:** 003-pos-products-inventory
**Deliverable:** T002

## Verdict: APPROVED WITH CONDITIONS

The architecture is sound, highly aligned with the Constitution, and follows standard Laravel-first patterns. It successfully balances thin-transport controllers, transaction-wrapped Actions, and strict data contracts. Approval is subject to meeting the Conditions for Approval outlined below, aimed at preventing concurrency bugs and resolving potential test suite bottlenecks.

---

## Constitution Compliance

The plan complies with the project Constitution on all points:
- **Laravel-First**: Eloquent models, Spatie permissions, Spatie activity logs, and standard Form Requests / Policies / API Resources are used.
- **Thin Transport**: All business logic (including checkout and voiding) is placed in dedicated Action classes, keeping controllers purely conversational.
- **Test-First with Pest**: Comprehensive unit and feature test requirements are planned.
- **Versioned Contract**: Routes are placed under `/api/v1` and use consistent API envelope structuring.
- **Security by Default**: Models declare explicit `$fillable` fields, rate-limiting is scheduled, and stock check concurrency is addressed.
- **Performance**: N+1 queries are mitigated via eager-loading requirements in API Resources, and grouping/aggregations are handled in DB-level joins.
- **YAGNI**: No speculative repository patterns or redundant interfaces are included.

---

## Risks

### R1 — Race condition on Idempotency Key check (High)
If the idempotency check in `CreateSaleAction` occurs before the transaction or is not executed with a database-level unique lock, parallel identical API requests might pass the validation phase concurrently and try to insert two sale rows, triggering database constraint errors (or duplicate sales if database constraints are misconfigured).
- *Consequence*: Redundant sales, 500 database errors, or race conditions under high concurrent POS usage.

### R2 — Test suite compatibility with MySQL locks (Medium)
The plan dictates using `lockForUpdate()` for concurrency. Tests run on SQLite in-memory, which does not fully support `lockForUpdate()` or row-level locking.
- *Consequence*: SQLite test suite might throw errors or ignore the locking behavior completely, masking concurrency integration bugs.

### R3 — Dompdf execution bounds (Medium)
PDF receipt generation is planned to run synchronously in `GenerateReceipt`. Large receipts or high API traffic could cause memory exhaust or execution timeout issues if not properly bound.
- *Consequence*: Thread starvation or API timeouts.

### R4 — Cascading deletes on `sales.member_id` vs `sale_items.product_id` (Low)
The data model specifies `sale_items.product_id` as `ON DELETE RESTRICT` (correct). We must ensure `sales.member_id` is set to `SET NULL` so deleting a member does not delete their sales history (which is critical for financial records).
- *Consequence*: Accidental loss of historical sales data when deleting a gym member.

---

## Improvements

1. **Idempotency Execution**: Ensure `idempotency_key` is checked inside the `DB::transaction` block using database SELECT FOR UPDATE or rely on the unique database key constraint to catch duplicate entries via `UniqueViolationException` and map it to a `201 Created` returning the existing sale.
2. **Mocking/Testing Concurrency**: Use separate test cases that simulate lock conditions, or write a clean mock wrapper if testing lock behavior under SQLite. Ensure tests handle SQLite limitations gracefully without failing standard test execution.
3. **Limit PDF Input**: Bound DOMPDF parameters strictly (e.g., maximum line items) to prevent memory leaks, and wrap PDF generation in a try-catch, failing back gracefully to HTML format if PDF rendering fails.

---

## Refactoring Suggestions

### Idempotency and Sale Creation Flow
```php
public function execute(CreateSaleData $data): Sale
{
    return DB::transaction(function () use ($data) {
        // 1. Check idempotency first with lock or direct lookup
        $existing = Sale::where('idempotency_key', $data->idempotencyKey)->first();
        if ($existing) {
            return $existing;
        }

        // 2. Lock products and validate stock
        foreach ($data->items as $item) {
            $product = Product::where('id', $item['product_id'])->lockForUpdate()->firstOrFail();
            if ($product->stock_quantity < $item['quantity']) {
                throw new InsufficientStockException($product);
            }
        }

        // 3. Create Sale, SaleItems, Decrement stock, write Movements...
    });
}
```

---

## Conditions for Approval

1. **Idempotency**: The check for `idempotency_key` must be the first operation inside the `DB::transaction` block of `CreateSaleAction`.
2. **Sales Member ON DELETE**: The `sales` table migration must explicitly set `member_id` to `nullable()` and define the foreign key constraint with `onDelete('set null')`.
3. **Receipt Generation Isolation**: Receipts PDF rendering must handle exception boundaries cleanly so that any failures in `dompdf` do not cause standard checkout operations to rollback or fail.
