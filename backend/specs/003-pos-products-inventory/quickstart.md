# Quickstart & Validation Guide: POS, Products & Inventory

**Feature**: Phase 2 — POS, Products & Inventory
**Date**: 2026-06-11

This guide describes how to validate the feature end-to-end. It is not an implementation guide — for database schema see [data-model.md](./data-model.md), for endpoint contracts see [contracts/api.md](./contracts/api.md).

---

## Prerequisites

- Phase 0 (auth, permissions, storage, broadcasting) and Phase 1 (members, subscriptions, polymorphic payments) fully deployed.
- `PosAccessSeeder` run to register all Phase 2 permissions.
- At least one user with `admin` or `manager` role (full access) and one with `cashier` role.

---

## Setup Commands

```bash
# Apply Phase 2 migrations
~/.config/herd-lite/bin/php artisan migrate

# Seed Phase 2 permissions
~/.config/herd-lite/bin/php artisan db:seed --class=PosAccessSeeder

# Run the full test suite to confirm green
~/.config/herd-lite/bin/php artisan test

# Start the server + queue for manual testing
composer dev
```

---

## Scenario 1: Product Catalog Management

**What to verify**: products CRUD, image upload, active toggle, stock adjust, low-stock flag.

```bash
# 1. Create a product
POST /api/v1/products
Content-Type: multipart/form-data
Authorization: Bearer <manager_token>
Fields: name="Protein Bar" category="supplements" sku="PRO-BAR-001"
        price=25.00 cost=12.00 stock_quantity=100 low_stock_threshold=10

# Expected: 201, ProductResource with is_low_stock=false

# 2. Adjust stock down to trigger low-stock
POST /api/v1/products/1/stock
{ "type": "out", "quantity": 92, "reason": "Correction" }

# Expected: 201, InventoryMovementResource; GET /products/1 shows stock_quantity=8, is_low_stock=true

# 3. Toggle inactive
PATCH /api/v1/products/1/toggle

# Expected: 200, is_active=false

# 4. Confirm inactive product excluded from POS (active filter)
GET /api/v1/products?is_active=true

# Expected: product 1 not in results
```

---

## Scenario 2: POS Checkout — Happy Path

**What to verify**: sale created, stock decremented, inventory movements written, payment recorded.

```bash
# Prerequisites: two active products with sufficient stock
# product_id=1, stock=50; product_id=2, stock=30

POST /api/v1/sales
Authorization: Bearer <cashier_token>
{
  "idempotency_key": "11111111-1111-1111-1111-111111111111",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 2, "quantity": 1 }
  ],
  "discount": "5.00",
  "payment_method": "cash"
}

# Expected:
# - 201 SaleResource
# - subtotal = (2 × product1.price) + (1 × product2.price)
# - total = subtotal - 5.00
# - GET /products/1 → stock_quantity = 48
# - GET /products/2 → stock_quantity = 29
# - Two InventoryMovement rows (type=out) written

# Idempotency: repeat the same request with same idempotency_key
# Expected: 201 with the SAME sale ID (no duplicate created)
```

---

## Scenario 3: Out-of-Stock Guard

```bash
# product_id=3, stock=1
POST /api/v1/sales
{
  "idempotency_key": "22222222-...",
  "items": [{ "product_id": 3, "quantity": 5 }],
  "payment_method": "card"
}

# Expected: 422
# { "error": { "code": "insufficient_stock", "details": { "items.0.quantity": "..." } } }
# Stock on product 3 unchanged
```

---

## Scenario 4: Receipt Generation

```bash
# Retrieve PDF receipt for sale id=1
GET /api/v1/sales/1/receipt
Accept: application/pdf
Authorization: Bearer <cashier_token>

# Expected: 200 application/pdf stream
# Receipt shows: items, quantities, unit prices, discount, total, payment method, date, cashier name

# HTML printable view
GET /api/v1/sales/1/receipt
Accept: text/html

# Expected: 200 HTML response with same data
```

---

## Scenario 5: Sale Void & Stock Reversal

```bash
# Void sale id=1 (2× product 1, 1× product 2)
POST /api/v1/sales/1/void
Authorization: Bearer <manager_token>
{ "reason": "Customer changed mind" }

# Expected:
# - 200, status=voided
# - GET /products/1 → stock_quantity back to 50
# - GET /products/2 → stock_quantity back to 30
# - InventoryMovement rows (type=in, reason="void #1") written
# - Payment for sale 1 → status=voided

# Attempt double void
POST /api/v1/sales/1/void
# Expected: 422, code=sale_already_voided

# Cashier (no sales.void) attempts void
POST /api/v1/sales/2/void  (with cashier_token)
# Expected: 403
```

---

## Scenario 6: Sales Reports

```bash
# Daily report
GET /api/v1/sales/daily?date=2026-06-11
Authorization: Bearer <manager_token>

# Expected: 200, total_revenue matches sum of today's completed sale totals

# Periodic report by product
GET /api/v1/sales/report?from=2026-06-01&to=2026-06-11&group_by=product

# Expected: 200, groups array shows per-product units sold and revenue
# Cross-check: sum of groups revenue = total_revenue in response

# Report without permission (cashier)
GET /api/v1/sales/report?from=2026-06-01&to=2026-06-11
# Expected: 403
```

---

## Scenario 7: Dashboard Widgets

```bash
GET /api/v1/dashboard/sales-today
# Expected: today's revenue and count, updates after each new sale

GET /api/v1/dashboard/top-products?limit=5&period=week
# Expected: top 5 products ranked by revenue this week
```

---

## Scenario 8: Permission Matrix Validation

```bash
# Cashier cannot create products
POST /api/v1/products  (cashier_token)
# Expected: 403

# Cashier cannot adjust inventory
POST /api/v1/products/1/stock  (cashier_token)
# Expected: 403

# Unauthenticated request
GET /api/v1/products
# Expected: 401
```

---

## Automated Test Suite

After implementation the full Pest suite should be green:

```bash
~/.config/herd-lite/bin/php artisan test

# Key test files to look for:
# tests/Feature/Api/V1/Products/ProductStoreTest.php
# tests/Feature/Api/V1/Products/ProductToggleTest.php
# tests/Feature/Api/V1/Products/ProductStockTest.php
# tests/Feature/Api/V1/Sales/SaleStoreTest.php
# tests/Feature/Api/V1/Sales/SaleVoidTest.php
# tests/Feature/Api/V1/Sales/SaleReceiptTest.php
# tests/Feature/Api/V1/Sales/SaleReportTest.php
# tests/Feature/Api/V1/Dashboard/DashboardSalesTest.php
# tests/Unit/Actions/Sales/CreateSaleTest.php
# tests/Unit/Actions/Sales/VoidSaleTest.php
```

---

## Integration Contract Checkpoints

Before closing Phase 2:

- [ ] `sales.sold_by_user_id` → `users` (not `employees`) — FK is on `users`
- [ ] `payments` table reused (no new table); `payable_type = App\Models\Sale`
- [ ] `payment_method` values are `cash`, `card`, `bank_transfer` — consistent with Phase 1
- [ ] Sale items' `unit_price` is a snapshot (not a live reference to `products.price`)
- [ ] `inventory_movements` written for every stock change (checkout out, void in, manual adjust)
- [ ] Real-time `new-sale` event broadcast on `dashboard` channel after successful checkout
