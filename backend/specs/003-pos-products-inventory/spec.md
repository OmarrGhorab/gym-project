# Feature Specification: POS, Products & Inventory

**Feature Branch**: `003-pos-products-inventory`

**Created**: 2026-06-11

**Status**: Draft

**Input**: Phase 2 — POS, Products & Inventory (retail/cashier operations for gym platform)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Product Catalog Management (Priority: P1)

A gym manager maintains the product catalog — adding, editing, and deactivating products (protein bars, water, supplements, etc.) along with their prices, costs, and stock thresholds. The manager can upload a product image and toggle products active/inactive without deleting them.

**Why this priority**: All POS operations depend on an accurate product catalog. Without products, no sales can be rung. This is the data foundation for every other scenario.

**Independent Test**: Can be fully tested by creating, editing, and toggling products; verifying stock quantities update on adjust; and confirming low-stock flagging — all without touching the POS or sales flows.

**Acceptance Scenarios**:

1. **Given** I am an authorized manager, **When** I create a product with name, category, SKU, price, cost, stock quantity, and upload an image, **Then** the product appears in the catalog with all fields correct and is marked active.
2. **Given** a product exists, **When** I update its price or stock threshold, **Then** the change is reflected immediately in the catalog.
3. **Given** a product's stock quantity falls at or below its low-stock threshold, **When** the catalog is viewed, **Then** the product is flagged as low-stock.
4. **Given** an active product, **When** I toggle it inactive, **Then** it no longer appears as available on the POS screen but remains in the catalog for historical records.
5. **Given** I perform a stock adjustment (in/out/manual-adjust), **When** the adjustment is saved, **Then** the product's stock quantity updates and an inventory movement record is created with the reason.

---

### User Story 2 - POS Checkout & Sale Creation (Priority: P1)

A cashier rings up a sale: searches for or browses products, adds them to a cart, applies an optional discount, selects a payment method, optionally links the sale to a member, and completes checkout. The system deducts stock, records the sale with all items, creates a payment record, and issues a receipt.

**Why this priority**: This is the core revenue-generating operation of the gym's retail side. The entire phase exists to enable this flow.

**Independent Test**: Can be fully tested end-to-end by creating a sale with multiple items and verifying stock decrements, payment record creation, and receipt output — with and without a linked member.

**Acceptance Scenarios**:

1. **Given** active products in catalog, **When** a cashier adds items to the cart and completes checkout with a payment method, **Then** a sale record is created with correct subtotal, discount, and total; each product's stock decreases by the sold quantity; an inventory movement (out) is written per product; and a payment record is linked to the sale.
2. **Given** a cart with a discount applied, **When** checkout completes, **Then** the sale total reflects the discount and the payment amount equals the discounted total.
3. **Given** a checkout in progress, **When** the cashier links a gym member to the sale, **Then** the sale is recorded with the member association and the member can be identified on the receipt and in reports.
4. **Given** a completed checkout, **When** the cashier requests a receipt, **Then** a formatted receipt is produced showing items, quantities, prices, discount, total, payment method, and date.
5. **Given** a product with 0 stock, **When** a cashier attempts to add it to the cart, **Then** the system prevents the addition and notifies the cashier that the item is out of stock.
6. **Given** a completed sale, **When** the sale is submitted, **Then** a real-time notification of the new sale is broadcast to the dashboard.

---

### User Story 3 - Sale Voiding & Stock Reversal (Priority: P2)

An authorized manager voids a completed sale. The system reverses the payment record and restores the stock quantities that were decremented at checkout.

**Why this priority**: Operational necessity — errors happen at the POS. Voiding must be permissioned and auditable. Lower priority than checkout because it is an exception path.

**Independent Test**: Can be fully tested by completing a sale, voiding it with the correct permission, and verifying stock is restored and payment is reversed — without touching reports.

**Acceptance Scenarios**:

1. **Given** a completed sale, **When** an authorized manager voids it, **Then** the sale status changes to voided, the payment record is reversed, and all deducted stock quantities are restored.
2. **Given** a voided sale, **When** a cashier attempts to void it again, **Then** the system rejects the request with an appropriate error.
3. **Given** a user without the void-sales permission, **When** they attempt to void a sale, **Then** they receive a 403 Forbidden response.

---

### User Story 4 - Sales Reporting (Priority: P2)

A manager reviews daily and periodic sales reports — total revenue for today, a date-range breakdown, sales by product, and sales by cashier. Reports reconcile with payment records.

**Why this priority**: Reporting gives the gym financial visibility. It depends on sales data (P1) existing but does not block the POS operation. Essential for business operations but a read-only concern.

**Independent Test**: Can be fully tested by seeding sales data and verifying that daily totals, date-range reports, product breakdowns, and cashier breakdowns return accurate, reconciled figures.

**Acceptance Scenarios**:

1. **Given** sales recorded today, **When** the manager views the daily report, **Then** the report shows each sale and a correct daily total that matches the sum of all payment records for the day.
2. **Given** a date range and optional filters (product, cashier), **When** the manager requests the periodic report, **Then** the report returns only sales within the range, filtered correctly, with accurate totals.
3. **Given** multiple products sold, **When** the by-product report is requested, **Then** each product shows total units sold and total revenue.
4. **Given** multiple cashiers, **When** the by-cashier report is requested, **Then** each cashier shows their sales count and revenue total.

---

### User Story 5 - Dashboard Sales Widgets (Priority: P3)

A manager glances at the dashboard and immediately sees today's sales total and a list of top-selling products.

**Why this priority**: Informational overlay on top of the core POS data. Useful but not operationally critical; implemented after the reporting data layer is in place.

**Independent Test**: Can be fully tested independently by verifying the widget endpoint returns today's revenue total and a ranked product list based on existing sales data.

**Acceptance Scenarios**:

1. **Given** sales exist for today, **When** the dashboard is loaded, **Then** the today's-sales widget shows the correct cumulative revenue.
2. **Given** sales history across multiple products, **When** the top-products widget is displayed, **Then** products are ranked by total revenue or units sold (configurable) and the top N are shown.

---

### Edge Cases

- What happens when a cashier attempts to sell more units of a product than are in stock? The system must reject the line item and report the available quantity.
- What happens if two cashiers simultaneously checkout the last unit of a product? The system must prevent overselling through concurrency-safe stock decrement.
- What happens when a sale contains a product that is later deactivated? The sale record and its items must remain intact for historical accuracy.
- What happens when the discount exceeds the subtotal? The system must reject discounts that result in a negative total.
- What happens if a void is attempted on a sale where the payment was already partially refunded externally? The void action must validate current payment state before reversing.
- What happens when no products match a search query on the POS screen? The system must display an empty-state message rather than an error.
- What happens when receipt generation fails? The sale must remain committed; receipt generation failure must not roll back the transaction.

## Requirements *(mandatory)*

### Functional Requirements

**Product Catalog**

- **FR-001**: The system MUST allow authorized users to create products with name, category, SKU, price, cost, stock quantity, low-stock threshold, and an optional image.
- **FR-002**: The system MUST allow authorized users to update any product field including replacing the product image.
- **FR-003**: The system MUST allow authorized users to toggle a product active or inactive without deleting it; inactive products are unavailable on the POS.
- **FR-004**: The system MUST allow authorized users to adjust product stock with a type (in/out/adjust) and a required reason; each adjustment creates an inventory movement record.
- **FR-005**: The system MUST flag any product whose stock quantity is at or below its low-stock threshold as "low stock" in catalog responses.

**POS & Sales**

- **FR-006**: The system MUST allow authorized cashiers to create a sale with one or more line items, each specifying a product and quantity.
- **FR-007**: The system MUST validate that each line item quantity does not exceed the current available stock at the moment of checkout; if it does, the sale must be rejected with a clear per-item error.
- **FR-008**: The system MUST decrement each product's stock quantity atomically when a sale is committed, and write one inventory movement record (type: out) per line item.
- **FR-009**: The system MUST compute sale subtotal, apply an optional discount, and derive the total; a discount that results in a zero or negative total must be rejected.
- **FR-010**: The system MUST record the payment method (cash, card, or bank_transfer) and create a payment record reusing the existing polymorphic payments table with `payable_type = Sale`.
- **FR-011**: The system MUST allow an optional member to be linked to a sale at checkout time.
- **FR-012**: The system MUST record the cashier who completed the sale (`sold_by_user_id` referencing users).
- **FR-013**: The system MUST generate a receipt for each completed sale, formatted with line items, quantities, unit prices, discount, total, payment method, and timestamp.
- **FR-014**: The system MUST broadcast a real-time event when a sale is completed, visible to dashboard subscribers.

**Void**

- **FR-015**: The system MUST allow authorized users to void a completed, non-voided sale; voiding reverses the payment record and restores all decremented stock quantities.
- **FR-016**: The system MUST reject void attempts on already-voided sales.
- **FR-017**: Voiding MUST be an atomic operation — if any part fails, no stock or payment changes must be applied.

**Reports**

- **FR-018**: The system MUST provide a daily sales list and total for the current day.
- **FR-019**: The system MUST provide a periodic sales report filterable by date range, product, and cashier, with per-filter totals that reconcile with payment records.

**Permissions & Audit**

- **FR-020**: The system MUST register and enforce distinct permissions: `products.view`, `products.create`, `products.update`, `products.delete`, `sales.create`, `sales.view`, `sales.void`, `inventory.adjust`, `reports.view`.
- **FR-021**: The system MUST record an audit log entry for every product create/update/delete, sale create/void, and inventory adjustment.

### Key Entities

- **Product**: Sellable item with catalog metadata (name, category, SKU), financial data (price, cost), stock state (quantity, low-stock threshold), an optional image, and active status.
- **Sale**: A completed transaction with computed totals, payment method, optional member link, cashier reference, status (completed/voided), and a collection of line items.
- **SaleItem**: One product line within a sale — records the product, quantity sold, unit price at time of sale, and line total. Unit price is captured at sale time and is immutable.
- **InventoryMovement**: An auditable record of every stock change — product, movement type (in/out/adjust), quantity delta, reason, and the user who made the change.
- **Payment** *(reused from Phase 1)*: Polymorphic payment record; Phase 2 adds rows with `payable_type = Sale`. No schema changes to the payments table.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cashier can complete a multi-item POS checkout (add items, apply discount, select payment method, submit) in under 60 seconds from opening the sale screen.
- **SC-002**: Stock quantities are accurate immediately after checkout — no overselling occurs even under concurrent transactions.
- **SC-003**: Daily and periodic sales report totals reconcile exactly (zero discrepancy) with the sum of payment records for the same period.
- **SC-004**: A receipt is available for every completed sale within 2 seconds of checkout confirmation.
- **SC-005**: All product, sale, and inventory operations enforce permission checks — unauthorized access attempts return 403 with no data leakage.
- **SC-006**: The real-time new-sale event reaches connected dashboard clients within 2 seconds of checkout completion.
- **SC-007**: The product catalog correctly identifies low-stock products and the low-stock flag updates in the same request cycle as the stock change.

## Assumptions

- Phase 0 (auth, permissions, storage, realtime/broadcasting) and Phase 1 (polymorphic payments table, members table) are fully deployed and functioning — they are hard prerequisites.
- The existing polymorphic `payments` table from Phase 1 is reused without schema modification; only new rows with `payable_type = Sale` are added.
- VAT/tax calculation and currency formatting are placeholder behaviors governed by the `settings` table; the receipt template exposes these hooks but their final values are deferred to Phase 4.
- `sold_by_user_id` on sales references the `users` table (not `employees`); Phase 3 will link to `employees.user_id` for commission tracking without requiring a backfill of this column.
- The low-stock threshold is stored per product (not globally in settings), as this provides more granular control without Phase 4 dependency.
- Receipt generation produces a PDF (via the already-installed dompdf package from Phase 0) and a printable HTML view; no email delivery of receipts is in scope for this phase.
- Basic CSV export of sales reports is in scope; full multi-format export with branding is deferred to Phase 4.
- Offline/disconnected POS resilience and double-submit protection are handled at the API layer (idempotency guards on sale creation) — client-side offline queuing is out of scope.
- Image uploads for products use the storage disk already configured in Phase 0; access control follows the same policy-gated streaming pattern established in Phase 1.
- The `payment_method` enum for sales is `cash`, `card`, `bank_transfer` — consistent with Phase 1's payment method allowlist.
