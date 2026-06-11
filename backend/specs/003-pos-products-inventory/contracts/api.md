# API Contract: POS, Products & Inventory

**Version**: v1
**Base path**: `/api/v1`
**Auth**: All endpoints require `Authorization: Bearer <token>` (Sanctum)
**Envelope**: Success → `{ "data": ..., "meta": ..., "message": "..." }` | Error → `{ "error": { "code": "...", "message": "...", "details": {} } }`

---

## Products

### `GET /products`

**Permission**: `products.view`
**Query params**: `?category=&is_active=&is_low_stock=&search=&sort=name,-stock_quantity&page=`

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Protein Bar",
      "category": "supplements",
      "sku": "PRO-BAR-001",
      "price": "25.00",
      "cost": "12.00",
      "stock_quantity": 48,
      "low_stock_threshold": 10,
      "is_low_stock": false,
      "is_active": true,
      "image_url": "/api/v1/products/1/image",
      "created_at": "2026-06-11T10:00:00Z"
    }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 42 }
}
```

**422** on invalid filter values. **403** without `products.view`.

---

### `POST /products`

**Permission**: `products.create`
**Request** (multipart/form-data):
```
name        string, required, max:191
category    string, required, max:100
sku         string, required, max:100, unique:products
price       numeric, required, gt:0
cost        numeric, required, gte:0
stock_quantity  integer, required, gte:0
low_stock_threshold  integer, required, gte:0, default:5
is_active   boolean, optional, default:true
image       file, optional, mimes:jpg,jpeg,png,webp, max:2048KB
```

**Response 201**: `ProductResource`
**422** on validation failure (including duplicate SKU). **403** without permission.

---

### `GET /products/{id}`

**Permission**: `products.view`
**Response 200**: `ProductResource` (full detail). **404** if not found. **403** without permission.

---

### `PUT /products/{id}`

**Permission**: `products.update`
**Request**: Same fields as POST (all optional except at least one field present). `sku` unique validation excludes current product.
**Response 200**: `ProductResource`. **404**. **422**. **403**.

---

### `PATCH /products/{id}/toggle`

**Permission**: `products.update`
**Response 200**: `{ "data": { "id": 1, "is_active": false }, "message": "Product deactivated." }`
**404**. **403**.

---

### `POST /products/{id}/stock`

**Permission**: `inventory.adjust`
**Request**:
```json
{ "type": "in", "quantity": 50, "reason": "Supplier restock" }
```
- `type`: required, `in|out|adjust`
- `quantity`: required, integer, gt:0 (for out: must not exceed current stock)
- `reason`: required, string, max:255

**Response 201**: `InventoryMovementResource` + updated `stock_quantity` on the product.
**422** if `type=out` and quantity exceeds stock. **404**. **403**.

---

### `GET /products/{id}/image`

**Permission**: `products.view` (policy-gated stream)
**Response 200**: Binary image stream (`Content-Type: image/jpeg` etc.)
**404** if product has no image. **403** without permission.

---

## Sales

### `POST /sales`

**Permission**: `sales.create`
**Request**:
```json
{
  "idempotency_key": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "member_id": 5,
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ],
  "discount": "10.00",
  "payment_method": "cash",
  "notes": "Regular customer"
}
```

Validation rules:
- `idempotency_key`: required, uuid — on duplicate, returns existing sale (201)
- `member_id`: nullable, integer, exists:members,id, must be active
- `items`: required, array, min:1
- `items.*.product_id`: required, integer, exists:products,id, must be active
- `items.*.quantity`: required, integer, gt:0, must not exceed product stock
- `discount`: nullable, decimal ≥ 0, must not exceed subtotal
- `payment_method`: required, `in:cash,card,bank_transfer`
- `notes`: nullable, string, max:500

Server derives: `subtotal`, `total`, decrements stock, writes inventory movements, creates payment.
`sold_by_user_id` = authenticated user (server-set, never trusted from input).

**Response 201**: `SaleResource` (with items, payment, member summary)
**422** on stock exceeded (per-item error key: `items.{n}.quantity`), invalid discount, inactive product/member.
**409** conflict if idempotency key belongs to a different user (rare edge case).
**403** without permission.

---

### `GET /sales`

**Permission**: `sales.view`
**Query params**: `?status=completed|voided&from=&to=&member_id=&sold_by=&page=`
**Response 200**: Paginated list of `SaleResource` (summary: id, total, status, cashier, member, created_at).
**422** on invalid filters. **403** without permission.

---

### `GET /sales/{id}`

**Permission**: `sales.view`
**Response 200**: Full `SaleResource` including items, payment, member.
**404**. **403**.

---

### `GET /sales/{id}/receipt`

**Permission**: `sales.view`
**Response 200**: PDF stream (`Content-Type: application/pdf`) or HTML printable view based on `Accept` header.
- `Accept: application/pdf` → PDF (dompdf)
- default → HTML printable view
**404**. **403**.

---

### `POST /sales/{id}/void`

**Permission**: `sales.void`
**Request**: `{ "reason": "Customer request" }` (optional, string, max:255)
**Response 200**: `{ "data": { "id": 5, "status": "voided" }, "message": "Sale voided and stock restored." }`
**422** if sale is already voided.
**404**. **403**.

---

### `GET /sales/daily`

**Permission**: `reports.view`
**Query params**: `?date=2026-06-11` (defaults to today)
**Response 200**:
```json
{
  "data": {
    "date": "2026-06-11",
    "total_sales": 12,
    "total_revenue": "3450.00",
    "sales": [ /* SaleResource list (no pagination — bounded by day) */ ]
  }
}
```
**422** on invalid date. **403** without permission.

---

### `GET /sales/report`

**Permission**: `reports.view`
**Query params**: `?from=2026-06-01&to=2026-06-30&product_id=&cashier_id=&group_by=product|cashier|day&page=`

Required: `from`, `to` (date, `from` ≤ `to`, max range 366 days).

**Response 200**:
```json
{
  "data": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "total_revenue": "42500.00",
    "total_sales": 185,
    "groups": [
      { "key": "Protein Bar", "product_id": 1, "units_sold": 120, "revenue": "3000.00" }
    ]
  },
  "meta": { "current_page": 1, "per_page": 50, "total": 12 }
}
```
**422** on invalid/missing dates or `from > to`. **403** without permission.

---

## Dashboard Widgets

### `GET /dashboard/sales-today`

**Permission**: `reports.view`
**Response 200**:
```json
{
  "data": {
    "date": "2026-06-11",
    "total_revenue": "1250.00",
    "total_sales": 8
  }
}
```

---

### `GET /dashboard/top-products`

**Permission**: `reports.view`
**Query params**: `?limit=5&period=today|week|month` (default: `week`, limit max: 20)
**Response 200**:
```json
{
  "data": [
    { "product_id": 1, "name": "Protein Bar", "units_sold": 48, "revenue": "1200.00" }
  ]
}
```
**422** on invalid period/limit. **403** without permission.

---

## Permission Matrix

| Endpoint | Required Permission |
|----------|---------------------|
| `GET /products*` | `products.view` |
| `POST /products` | `products.create` |
| `PUT /products/{id}` | `products.update` |
| `PATCH /products/{id}/toggle` | `products.update` |
| `POST /products/{id}/stock` | `inventory.adjust` |
| `GET /products/{id}/image` | `products.view` |
| `POST /sales` | `sales.create` |
| `GET /sales*` | `sales.view` |
| `GET /sales/{id}/receipt` | `sales.view` |
| `POST /sales/{id}/void` | `sales.void` |
| `GET /sales/daily` | `reports.view` |
| `GET /sales/report` | `reports.view` |
| `GET /dashboard/sales-today` | `reports.view` |
| `GET /dashboard/top-products` | `reports.view` |

---

## Error Codes Reference

| code | HTTP | Meaning |
|------|------|---------|
| `validation_failed` | 422 | Input validation errors (details contains field errors) |
| `insufficient_stock` | 422 | One or more items exceed available stock |
| `sale_already_voided` | 422 | Void attempted on already-voided sale |
| `inactive_product` | 422 | POS item references inactive product |
| `unauthenticated` | 401 | Missing or invalid bearer token |
| `forbidden` | 403 | Authenticated but lacks required permission |
| `not_found` | 404 | Resource does not exist |
| `idempotency_conflict` | 409 | Idempotency key already used by a different user |
