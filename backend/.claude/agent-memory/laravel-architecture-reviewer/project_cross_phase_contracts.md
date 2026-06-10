---
name: project-cross-phase-contracts
description: Binding cross-phase data contracts (sold_by_user_id, polymorphic payments, notifications, settings) that must be preserved across all phases
metadata:
  type: project
---

These are binding across phases (from `CLAUDE.md` integration map). A design that breaks one is a blocker:

1. **`sold_by_user_id` → `users`, NEVER `employees`.** On `subscriptions` (P1) and `sales` (P2). Avoids a forward dependency on Phase 3. Phase 3 links commissions via `employees.user_id` + a backfill command. `on delete set null`.
2. **Polymorphic `payments` defined ONCE in P1** (`payable_type`/`payable_id`), `status ∈ {paid, partial, due}`, money `decimal(10,2)`. P2 attaches `Sale` as another payable; P3 reads it as the single revenue source. Do NOT fork payment logic per-payable, no subscription-only columns. Subscription balance is DERIVED (`price_paid − SUM(amount)`), not a denormalized column (YAGNI).
3. **`notifications`** = Laravel native table (`make:notifications-table` shape), `notifiable` = User. Reused by P2/P3. Realtime channel follows P0 broadcast-readiness.
4. **`settings.reminder_days`** consumed (read) in P1 by reminder + expiring-soon logic; managed via Settings UI in P4. Default 7 if unset.

**Why:** Later phases were planned assuming these exact shapes; forking or re-pointing them forces expensive rework and breaks revenue attribution.
**How to apply:** On every phase review, grep the data-model for these and confirm FK targets, polymorphism, and derived-balance approach are intact.
