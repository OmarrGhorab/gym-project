# Research: POS, Products & Inventory

**Feature**: Phase 2 — POS, Products & Inventory
**Date**: 2026-06-11

---

## Decision 1: Concurrent Stock Decrement Safety

**Decision**: Use `SELECT ... FOR UPDATE` (row-level locking) inside `DB::transaction` within `CreateSaleAction`, identical to the `RecordPayment` pattern established in Phase 1. Re-read product rows under lock before decrementing stock.

**Rationale**: The POS is the highest-traffic write screen. Two cashiers ringing up the last unit simultaneously is a realistic scenario. Row-level locking prevents overselling at zero extra infrastructure cost (MySQL InnoDB, already in use). The pattern is already proven in Phase 1's `RecordPayment` — consistency in the codebase.

**Alternatives considered**:
- Optimistic locking (version column + retry) — adds retry logic complexity; row lock is simpler and sufficient for the expected concurrency level of a gym POS.
- Application-level mutex (Redis SETNX) — extra infrastructure dependency; row lock achieves the same without Redis being required for correctness.

---

## Decision 2: Stock Decrement — Per-Item or Bulk

**Decision**: Decrement each product's stock quantity individually in a loop inside the transaction, using `lockForUpdate()->findOrFail()` per product. Write one `InventoryMovement` row (type: out) per line item.

**Rationale**: Sales have a small number of line items (gym retail typically 1–5 items). A per-item loop inside a transaction is simple, auditable, and avoids complex bulk-update queries. Each `InventoryMovement` row being a single product preserves audit granularity (you can see which product moved when).

**Alternatives considered**:
- Bulk `whereIn` update — faster for large item counts but makes row-level locking harder and loses per-row audit granularity.

---

## Decision 3: Receipt Generation Strategy

**Decision**: Generate receipts lazily on demand via `GET /sales/{id}/receipt` — do not pre-generate or store the PDF at checkout time. The action streams the PDF directly from dompdf. The sale data (already persisted) is the source of truth.

**Rationale**: Receipt requests are infrequent relative to checkouts. Pre-generating a PDF at checkout time adds latency to the most performance-sensitive operation. On-demand generation keeps checkout fast and uses the already-installed `barryvdh/laravel-dompdf` (from Phase 0) without queuing or storage overhead.

**Alternatives considered**:
- Queue PDF generation + store to disk — adds a job, a storage concern, and a background dependency for a low-frequency operation. Unnecessary.
- Synchronous PDF generation at checkout and embed in response — makes checkout response larger and slower; not needed for the POS workflow.

**VAT/currency**: Values come from `settings` table keys (`vat_rate`, `currency_symbol`, `currency_code`). Default to 0% VAT and `EGP`/`LE` if not set. Phase 4 finalizes the settings UI; the receipt template reads these keys today.

---

## Decision 4: Sale Void — Full Void Only, No Partial Refund

**Decision**: `VoidSaleAction` voids the entire sale atomically. No partial-item refund in Phase 2. A voided sale sets `status = voided`, creates a reversal `InventoryMovement` (type: in, reason: "void") per line item, and marks the linked payment as voided (updates `status` on the existing payment row).

**Rationale**: Partial refunds introduce significant complexity (which items, prorated discount, remaining balance). The Phase 2 spec calls for "void restocks and reverses payment" as a single operation. Partial refunds are a Phase 4 concern if needed. Full-void atomically in a transaction keeps the logic clean and testable.

**Alternatives considered**:
- Soft-delete the sale only — leaves stock and payment in an inconsistent state; unacceptable.
- Mark sale voided + create a credit-note payment — adds new payment states; overkill for Phase 2.

---

## Decision 5: Sales Reports — Query Strategy

**Decision**: Use `DB::table` / Eloquent with `JOINs`, `groupBy`, and `selectRaw` aggregate queries (SUM, COUNT). Use keyset pagination (cursor-based via `cursorPaginate`) for the list endpoints; use aggregate-only responses (no pagination) for summary/total endpoints. Add composite indexes `(created_at)` on `sales` and `(sale_id, product_id)` on `sale_items`.

**Rationale**: Report queries aggregate across multiple rows; N+1 Eloquent loading is inappropriate here. JOINs with aggregates match the read pattern. Keyset pagination avoids large `OFFSET` performance regression on growing tables. Composite indexes on the queried columns make these queries fast.

**Alternatives considered**:
- Load all sales then aggregate in PHP — unacceptable for large datasets.
- Cache report results in Redis — premature for Phase 2; add in Phase 4 if hot-path profiling justifies it.

---

## Decision 6: Low-Stock Threshold Location

**Decision**: Stored per-product as `low_stock_threshold` column (default 5). The catalog API returns `is_low_stock` as a computed boolean in `ProductResource` (`stock_quantity <= low_stock_threshold`). No global setting for this in Phase 2.

**Rationale**: Per-product thresholds are more useful (protein powder needs 10 in stock; a keychain needs 2). The spec confirmed per-product storage. A global setting in Phase 4 can override if needed, reading `low_stock_threshold` as a fallback.

**Alternatives considered**:
- Global `settings` key — less granular; would require an override mechanism anyway.

---

## Decision 7: Real-Time New-Sale Event

**Decision**: Broadcast a `NewSaleEvent` using Laravel's broadcasting system (Pusher-compatible driver configured in Phase 0) on the `dashboard` private channel after a sale commits. The event payload includes sale ID, total, cashier name, and timestamp. Dispatched inside `CreateSaleAction` after the transaction commits (not inside it — broadcasting should not block the transaction).

**Rationale**: Laravel broadcasting is native and already configured in Phase 0. Dispatching after the transaction (not inside it) ensures the broadcast only fires on successful commits.

**Alternatives considered**:
- Broadcast inside the transaction — risks broadcasting on a transaction that later rolls back.
- Polling from the frontend — less real-time and increases server load.

---

## Decision 8: Product Image Storage & Access

**Decision**: Product images stored on the `local` disk under `products/` using the same policy-gated streaming pattern from Phase 1 member photos. `GET /products/{id}/image` streams the image through the controller, authorized by `ProductPolicy@view`. The public filename stored in the `image` column is the storage path (relative).

**Rationale**: Consistency with Phase 1's approach. Private disk + policy gate ensures images are not directly web-accessible without authentication.

**Alternatives considered**:
- Public disk with direct URLs — exposes product images without auth, which may be acceptable for public-facing products; however, consistency with Phase 1 and the ability to gate access is preferred.

---

## Decision 9: `payment_method` Enum for Sales

**Decision**: Reuse Phase 1's `payment_method` allowlist: `cash`, `card`, `bank_transfer`. Validated via `in:cash,card,bank_transfer` in the Form Request, consistent with `StorePaymentRequest` (already patched post Phase 1 review).

**Rationale**: Phase 1 normalized this allowlist precisely so Phase 2 could reuse it. Keeping it identical ensures the `payments` table has uniform `method` values across subscription payments and sale payments.

---

## Decision 10: Sale Idempotency Guard

**Decision**: Implement a client-supplied `idempotency_key` (UUID) on `POST /sales`. Store it on the `sales` table. On duplicate key, return the existing sale (201). Unique index on `idempotency_key` enforces this at the database level.

**Rationale**: The POS is the highest-traffic screen and double-submit is a realistic failure mode (slow network, user hitting checkout twice). An idempotency key is the clean, stateless solution that prevents duplicate sales without session state.

**Alternatives considered**:
- Frontend debouncing only — insufficient; network retries can still cause duplicates at the server.
- Redis-based dedup — extra infrastructure; unique DB index achieves the same with zero overhead.
