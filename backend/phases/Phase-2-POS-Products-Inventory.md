# Phase 2 — POS, Products & Inventory

---

## 1. Objective
Build retail/cashier operations: products (water, protein bars, scoops, …), a fast POS, automatic inventory deduction, receipts, and sales reporting (daily + periodic detailed).

## 2. Scope
### In scope
- Products CRUD + images + stock management.
- POS / cashier screen with cart, discount, payment method, optional member link, checkout, receipt.
- Inventory movements (in/out/adjust) + low-stock indicator.
- Sales reports: daily, date-range, by product, by cashier.
- Dashboard widgets: today's sales total, top products.

### Out of scope (handled later)
- Commission on sales → Phase 3 (this phase **captures `sold_by_user_id`** and the amounts).
- Full multi-format export & final permission matrix → Phase 4 (basic CSV may exist here).
- Payroll/financial roll-up → Phase 3 (which reads sales + payments).

## 3. Prerequisites
- **Phase 0:** auth, permissions, layout, storage, realtime.
- **Phase 1:** `payments` polymorphic table (reused for sale payments); `members` (for optional member-linked sales).

## 4. Deliverables
1. Product catalog with stock + low-stock flagging.
2. Working POS that completes a sale, decrements stock, and issues a receipt.
3. Accurate daily and periodic sales reports that reconcile with payments.

## 5. Detailed Tasks

### 5.1 Backend
- **Products:** model + CRUD; fields `name, category, sku, price, cost, stock_quantity, image, is_active`; image upload; active toggle.
- **Stock:** `inventory_movements(product_id, type[in|out|adjust], quantity, reason, created_by)`; stock-adjust endpoint; low-stock threshold (in `settings` or per product).
- **Sales** (Actions pattern):
  - `CreateSaleAction` — validate items, compute `subtotal/discount/total`, set `payment_method`, optional `member_id`, `sold_by_user_id` (current user); **decrement stock** + write `inventory_movements (out)`; create a `payment` (reusing Phase 1's polymorphic table; `payable_type=Sale`).
  - Receipt generation (PDF via dompdf) / printable view; respect VAT/currency from `settings` (placeholder until Phase 4 finalizes).
  - `VoidSaleAction` (permissioned) → restock + reverse payment.
- **Reports:** daily list + daily total; periodic detailed report by `date range`, `product`, `cashier`. Use **JOINs + composite indexes** (`sales(created_at)`, `sale_items(sale_id, product_id)`); avoid large `OFFSET` (keyset pagination).
- **Permissions:** register `products.*`, `sales.*`, `inventory.*`.
- **Audit:** `LogsActivity` on Product, Sale, InventoryMovement.
- **Realtime:** broadcast a `new-sale` event to the dashboard channel.
- **Tests:** stock decrement, totals, void/restock, report accuracy.

### 5.2 Frontend
- `/products` — list + create/edit + stock adjust + **low-stock indicator**.
- `/pos` — cashier screen: product grid/search, cart (qty, discount), payment method, optional member attach, checkout → receipt; **keyboard-friendly**, optimistic updates via TanStack Query.
- **Receipt** — view/print component.
- `/sales` — reports (daily, date-range, by product, by cashier) with charts; basic CSV export (full export wired in Phase 4).
- **Dashboard widgets** — today's sales total, top products.

## 6. Database (tables introduced / modified)
| Table | Key columns |
|---|---|
| `products` | id, name, category, sku, price, cost, stock_quantity, image, is_active |
| `sales` | id, member_id?, subtotal, discount, total, paid, payment_method, status, **sold_by_user_id (FK users)**, created_at |
| `sale_items` | id, sale_id, product_id, quantity, unit_price, total |
| `inventory_movements` | id, product_id, type[in/out/adjust], quantity, reason, created_by |
| `payments` | *(reused from Phase 1; new rows with `payable_type=Sale`)* |

> **Phasing note:** like Phase 1, `sold_by_user_id` references **users**; Phase 3 links to `employees.user_id` for commissions.

## 7. API Endpoints
| Method | Endpoint |
|---|---|
| GET / POST | `/products` |
| PUT | `/products/{id}` |
| PATCH | `/products/{id}/toggle` |
| POST | `/products/{id}/stock` |
| POST | `/sales` |
| GET | `/sales` · `/sales/{id}` |
| GET | `/sales/{id}/receipt` |
| POST | `/sales/{id}/void` |
| GET | `/sales/daily` |
| GET | `/sales/report?from=&to=&product_id=&cashier_id=` |

## 8. Frontend Pages & Components
`/products` (list + form + stock adjust), `/pos` (cart + checkout + receipt), `/sales` (reports + charts), dashboard widgets (today's sales, top products).

## 9. Integration Contracts (exposed for later phases)
- **`sales` + `sale_items`** — **Phase 3** uses them for commissions, revenue, top-products KPIs, and per-employee performance.
- **`sold_by_user_id` on sales** — **Phase 3** maps to `employees.user_id` for commissions.
- **Sale `payments`** — feed **Phase 3** revenue alongside subscription payments.
- **`inventory_movements`** — available for future stock/cost reporting.
- **Receipt template + VAT/currency hooks** — finalized in **Phase 4** Settings/branding.

## 10. Acceptance Criteria (Definition of Done)
- [ ] Product CRUD + stock adjust + low-stock flag.
- [ ] POS checkout creates `sale` + `sale_items` + `payment`, decrements stock, writes `inventory_movements`.
- [ ] Receipt generated (PDF/printable).
- [ ] Daily + periodic reports accurate and reconcile with payments.
- [ ] Void restocks and reverses payment (if implemented).
- [ ] `new-sale` realtime event reaches the dashboard.
- [ ] Permissions enforced (`products.*`, `sales.*`, `inventory.*`).

## 11. Demo Checklist
Add products → ring up a multi-item POS sale → stock drops → receipt prints → daily report shows the correct total and reconciles with payments.

## 12. Notes
- POS must be **fast and resilient** (offline edge cases, double-submit guards) — it's the highest-traffic screen.
- Reuse the Phase 1 `payments` contract exactly; don't fork a parallel payments concept for sales.
- Keep VAT/receipt formatting behind `settings` so Phase 4 can finalize without code changes.
