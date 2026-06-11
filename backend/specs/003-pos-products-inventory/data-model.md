# Data Model: POS, Products & Inventory

**Feature**: Phase 2 — POS, Products & Inventory
**Date**: 2026-06-11

---

## New Tables

### `products`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint unsigned` | PK, auto-increment | |
| `name` | `varchar(191)` | NOT NULL | |
| `category` | `varchar(100)` | NOT NULL | e.g. drinks, supplements, accessories |
| `sku` | `varchar(100)` | NOT NULL, UNIQUE | |
| `price` | `decimal(10,2)` | NOT NULL | Selling price |
| `cost` | `decimal(10,2)` | NOT NULL | Cost of goods |
| `stock_quantity` | `int unsigned` | NOT NULL, default 0 | Current on-hand stock |
| `low_stock_threshold` | `int unsigned` | NOT NULL, default 5 | Flag when stock ≤ this |
| `image` | `varchar(500)` | nullable | Storage path (local disk) |
| `is_active` | `boolean` | NOT NULL, default true | |
| `created_at` | `timestamp` | nullable | |
| `updated_at` | `timestamp` | nullable | |

**Indexes**:
- `products(sku)` — UNIQUE (already listed)
- `products(is_active)` — filtered POS queries
- `products(category)` — category filter on catalog

**Relationships**:
- `hasMany` → `SaleItem`
- `hasMany` → `InventoryMovement`

---

### `sales`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint unsigned` | PK, auto-increment | |
| `idempotency_key` | `varchar(36)` | NOT NULL, UNIQUE | Client-supplied UUID |
| `member_id` | `bigint unsigned` | nullable, FK → `members(id)` ON DELETE SET NULL | Optional member link |
| `sold_by_user_id` | `bigint unsigned` | NOT NULL, FK → `users(id)` ON DELETE RESTRICT | Cross-phase contract |
| `subtotal` | `decimal(10,2)` | NOT NULL | Sum of line item totals |
| `discount` | `decimal(10,2)` | NOT NULL, default 0.00 | |
| `total` | `decimal(10,2)` | NOT NULL | `subtotal - discount` |
| `payment_method` | `varchar(20)` | NOT NULL | `cash\|card\|bank_transfer` |
| `status` | `varchar(20)` | NOT NULL, default 'completed' | `completed\|voided` |
| `notes` | `text` | nullable | Optional cashier notes |
| `created_at` | `timestamp` | nullable | |
| `updated_at` | `timestamp` | nullable | |

**Indexes**:
- `sales(sold_by_user_id)` — cashier reports
- `sales(member_id)` — member sales history
- `sales(status)` — filter completed vs voided
- `sales(created_at)` — date-range reports (composite with status: `(status, created_at)`)
- `sales(idempotency_key)` — UNIQUE (already listed)

**Relationships**:
- `belongsTo` → `User` (as `soldBy`)
- `belongsTo` → `Member` (nullable)
- `hasMany` → `SaleItem`
- `morphOne` → `Payment` (`payable_type = App\Models\Sale`)

---

### `sale_items`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint unsigned` | PK, auto-increment | |
| `sale_id` | `bigint unsigned` | NOT NULL, FK → `sales(id)` ON DELETE CASCADE | |
| `product_id` | `bigint unsigned` | NOT NULL, FK → `products(id)` ON DELETE RESTRICT | Restrict to preserve history |
| `quantity` | `int unsigned` | NOT NULL | |
| `unit_price` | `decimal(10,2)` | NOT NULL | Price at time of sale (immutable snapshot) |
| `total` | `decimal(10,2)` | NOT NULL | `quantity × unit_price` |
| `created_at` | `timestamp` | nullable | |
| `updated_at` | `timestamp` | nullable | |

**Indexes**:
- `sale_items(sale_id)` — load items for a sale (also FK)
- `sale_items(product_id)` — product sales report (also FK)
- Composite `(sale_id, product_id)` — covering index for joins in reports

**Relationships**:
- `belongsTo` → `Sale`
- `belongsTo` → `Product`

---

### `inventory_movements`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint unsigned` | PK, auto-increment | |
| `product_id` | `bigint unsigned` | NOT NULL, FK → `products(id)` ON DELETE RESTRICT | |
| `type` | `varchar(20)` | NOT NULL | `in\|out\|adjust` |
| `quantity` | `int` | NOT NULL | Positive = increase, negative = decrease |
| `reason` | `varchar(255)` | NOT NULL | |
| `created_by` | `bigint unsigned` | nullable, FK → `users(id)` ON DELETE SET NULL | |
| `created_at` | `timestamp` | nullable | |
| `updated_at` | `timestamp` | nullable | |

**Indexes**:
- `inventory_movements(product_id)` — stock history per product (also FK)
- `inventory_movements(created_by)` — audit by user (also FK)
- `inventory_movements(created_at)` — time-range filtering

**Relationships**:
- `belongsTo` → `Product`
- `belongsTo` → `User` (as `createdBy`)

---

## Modified / Reused Tables

### `payments` *(reused from Phase 1 — no schema changes)*

New rows with `payable_type = App\Models\Sale` and `payable_id = sale.id`. The `status` column values (`paid`, `partial`, `due`) apply: a sale is always paid in full at checkout (no partial-payment POS flow in Phase 2), so `status = paid`. Voiding updates the existing payment row to `status = voided` (new value — see migration note below).

> **Migration note**: Add `voided` to the `payments.status` allowed values. Because it's a `varchar`, no schema migration is required — the application enforces the enum via validation. The `payments` table already exists; no `ALTER TABLE` needed.

---

## Entity Relationships (Summary)

```
User ─────────────────────────────────────────────┐
  │ sold_by_user_id (RESTRICT)                     │
  ▼                                                │
Sale ──── SaleItem ──── Product ──── InventoryMovement
  │                                       ▲
  │ (morphOne)                            │ created_by (SET NULL)
  ▼                                       │
Payment                                  User
  (payable_type=Sale)

Member ─── (optional) ──► Sale
```

---

## State Transitions

### Sale Status

```
[new checkout] → completed
completed      → voided  (VoidSaleAction — permissioned)
voided         → (terminal — no further transitions)
```

### Payment Status (sale payments)

```
checkout completes → paid
sale voided        → voided
```

### Product `stock_quantity`

```
stock_adjust (in)    → +quantity  (InventoryMovement type=in)
sale checkout (out)  → -quantity  (InventoryMovement type=out, per line item)
sale void (in)       → +quantity  (InventoryMovement type=in, reason="void #{sale_id}")
manual adjust        → ±quantity  (InventoryMovement type=adjust)
```

---

## Eloquent Models Summary

| Model | Key `$fillable` | Key `$hidden` | Key Scopes |
|-------|----------------|---------------|------------|
| `Product` | name, category, sku, price, cost, stock_quantity, low_stock_threshold, image, is_active | — | `active()`, `lowStock()` |
| `Sale` | idempotency_key, member_id, sold_by_user_id, subtotal, discount, total, payment_method, status, notes | — | `completed()`, `voided()` |
| `SaleItem` | sale_id, product_id, quantity, unit_price, total | — | — |
| `InventoryMovement` | product_id, type, quantity, reason, created_by | — | — |

All models declare explicit `$fillable` (no `$guarded = []`). Monetary columns stored as `decimal`; application uses `bcmath` for arithmetic.

---

## Seeders

`PosAccessSeeder` — registers permissions:
- `products.view`, `products.create`, `products.update`, `products.delete`
- `sales.view`, `sales.create`, `sales.void`
- `inventory.adjust`
- `reports.view`

Assigns to appropriate roles (admin gets all; cashier gets `products.view`, `sales.view`, `sales.create`; manager gets all except admin-only gates).

---

## Migration Order

1. `create_products_table`
2. `create_sales_table` (FK → `members`, `users`)
3. `create_sale_items_table` (FK → `sales`, `products`)
4. `create_inventory_movements_table` (FK → `products`, `users`)
