# Phase 0 Research: Members, Subscriptions & Plans

**Feature**: `002-members-subscriptions-plans` | **Date**: 2026-06-10

This document records the design decisions that resolve the spec's open assumptions and the technical choices needed before implementation. Each entry: **Decision / Rationale / Alternatives considered**. All `NEEDS CLARIFICATION` items from Technical Context are resolved here.

---

## 1. Freeze-aware effective end-date math

**Decision**: Store the subscription's `end_date` as the *current effective* end date. On freeze: persist a `subscription_freezes` row with `days`, set `status = frozen`, and add `days` to `end_date`. On unfreeze: set `status = active`; `end_date` already reflects the added days (no second adjustment). Enforce `SUM(subscription_freezes.days) <= plan.max_freeze_days` *before* applying a new freeze. Freeze `days` is derived from `freeze_start`/`freeze_end` (inclusive day count), validated `>= 1`.

**Rationale**: Keeping `end_date` as the single effective value means every read path (expiry job, expiring-soon list, member profile) uses one column with no recomputation — eliminating drift. The freeze rows are the audit trail and the cap-enforcement source of truth. Adding days at freeze time (not unfreeze time) makes a frozen subscription's end date already correct if it is later stopped or inspected.

**Alternatives considered**:
- *Compute effective end date on read from base + sum(freezes)*: rejected — every consumer must replicate the formula; high N+1 and drift risk; harder to index for the expiry query.
- *Add days at unfreeze*: rejected — leaves the end date wrong while frozen, complicating stop/expiry edge cases.

**Edge handling**: A subscription frozen past its *original* end date must not be auto-expired while `status = frozen` (the expiry query filters `status = active` only). Cumulative cap is checked against the sum including the pending freeze.

---

## 2. Renewal start-date rule & history preservation

**Decision**: `RenewSubscriptionAction` always **inserts a new `subscriptions` row**; the prior row is never mutated. Start date rule:
- If the source subscription is **not yet expired** (`end_date >= today` and status active/frozen): new `start_date = source.end_date + 1 day` (contiguous, no gap/overlap).
- If the source subscription is **already expired/stopped** (`end_date < today`): new `start_date = today`.
- New `end_date = start_date + plan.duration_days`. The renewal may target the same plan or a different active plan.

**Rationale**: Matches member expectations (paid-up renewals extend continuously; lapsed members restart today) and the spec's Acceptance Scenario for history. A new row preserves the full history visible on the member profile and keeps `sold_by_user_id` accurate per sale for Phase 3 commissions.

**Alternatives considered**:
- *Mutate the existing row's dates*: rejected — destroys history, breaks per-sale commission attribution.
- *Always start today*: rejected — penalizes members who renew early by discarding remaining paid days.

---

## 3. Monetary precision

**Decision**: Store all money as `decimal(10, 2)` columns (`plans.price`, `subscriptions.price_paid`, `subscriptions.discount`, `payments.amount`). Compute balances with PHP's `bcmath` via Laravel's `Illuminate\Support\Number`/`BigNumber` or explicit `bcsub`/`bccmp` — never native float arithmetic. The amount owed for a subscription = `price_paid` (the agreed, post-discount price actually owed); remaining due = owed − SUM(payments.amount for that subscription).

**Rationale**: Constitution VI + spec edge case demand no cent-level drift. `decimal(10,2)` is exact in MySQL; `bcmath` avoids binary-float rounding when summing partials. Caps single amount at 99,999,999.99 which is ample for gym pricing.

**Alternatives considered**:
- *Float/double columns*: rejected — rounding errors in dues sums (explicit spec failure mode).
- *Integer minor units*: viable and equally exact, but `decimal` casts read more naturally in Resources and align with typical Laravel gym schemas; chosen for readability with `bcmath` for the arithmetic.

---

## 4. Payment model — polymorphic, status, and "owed" semantics

**Decision**: One `payments` table, polymorphic via `payable_type`/`payable_id` (nullable-morphs-safe, indexed). Columns: `amount` (decimal), `method` (string), `status ∈ {paid, partial, due}`, `paid_at` (nullable), `due_date` (nullable), `created_by`. A subscription's payment state is derived: a single payment row's `status` reflects that payment; the subscription's outstanding due is computed from `price_paid − SUM(amount)`. `RecordPayment` writes a payment row and sets its `status` (`paid` when it clears the balance, `partial` when a balance remains, `due` for an unpaid scheduled amount).

**Rationale**: This is the binding cross-phase contract — Phase 2 attaches `Sale`, Phase 3 reads `payments` as the revenue source. Keeping the table generic (no subscription-only columns) prevents the fork the source doc explicitly warns against. Deriving the subscription balance from the sum (rather than a denormalized `balance` column) avoids update anomalies.

**Alternatives considered**:
- *Denormalized `balance`/`paid_total` on subscriptions*: rejected for now (YAGNI + anomaly risk); revisit only if the dues query becomes a proven hot path (then cache or add a maintained column with tests).
- *Separate `subscription_payments` table*: rejected — forks payment logic, violates the contract.

---

## 5. List filtering / sorting — Spatie Query Builder

**Decision**: Use `spatie/laravel-query-builder` (already installed) for member/subscription/payment list endpoints: allowlisted filters (`status`, `member_id`, search on name/phone), allowlisted sorts, and Laravel pagination. Explicit allowlists only — never pass raw client input to the query.

**Rationale**: Constitution I (exhaust native/installed before custom) — the package is already a Phase 0 dependency. Allowlisting satisfies Security V (no trusting client input for query shape) and keeps filtering consistent across endpoints (Contract IV).

**Alternatives considered**:
- *Hand-rolled query parsing*: rejected — reinvents an installed capability, easy to leak unindexed/unsafe filters.

---

## 6. Member photo storage & access (SEC-M3 resolution)

**Decision**: Store member photos on the **`public` disk** under `members/{id}/...` for non-sensitive avatars, OR on a private disk streamed through an authorized controller if treated as PII. **Chosen**: store on a private disk (`local`/`remote`) and serve via an authenticated, Policy-gated `GET /members/{id}/photo` controller action (stream), with `serve => false` exposure avoided. Validate uploads: `image` mime (`jpg/jpeg/png/webp`), max ~5 MB, dimensions sane. Persist the path only after a successful store (transactional ordering to avoid half-written records).

**Rationale**: Member photos are the first private files in the system; SEC-M3 from Phase 0 requires gating the serve route before private files land. Streaming through a Policy keeps authorization enforced and avoids public enumeration of member images.

**Alternatives considered**:
- *Public disk with guessable URLs*: rejected — PII exposure, no authorization.
- *Signed temporary URLs*: viable for remote/S3; kept as an option when `remote` points at S3, but the authorized-stream controller is the baseline that works on `local` too.

---

## 7. Reminder selection, scheduling, idempotency & expiry

**Decision**: Two scheduled console commands registered in `routes/console.php`, run daily:
- `subscriptions:send-renewal-reminders` → reads `settings.reminder_days` (default 7 if unset), finds `status = active` subscriptions with `end_date` within `[today, today + reminder_days]`, and for each dispatches a queued `SendRenewalReminderJob`. Idempotency: a subscription is reminded at most once per day — guard via a uniqueness check on a notification of that type for that subscription dated today (or a `reminded_on` date column / cache key). No duplicate reminders on re-run.
- `subscriptions:expire` → sets `status = expired` for `status = active` subscriptions with `end_date < today`. Frozen and stopped subscriptions are untouched.

Heavy/external delivery happens in the **queued job**, never in the command loop (Constitution VI).

**Rationale**: Native scheduler + queue is the prescribed tool. Splitting reminder vs. expiry into two commands keeps each single-responsibility and independently testable. Reading the lead time from settings honors the `settings.reminder_days` contract.

**Alternatives considered**:
- *One command doing both*: rejected — muddies responsibility and testing; the underlying Actions can still be shared.
- *Inline delivery in the command*: rejected — violates "queue heavy/external work."

---

## 8. Notification delivery — in-app + provider hook

**Decision**: Use Laravel's native notification system with the **`database` channel** (the `notifications` table, native shape) for in-app delivery, plus a custom **provider-hook channel** that routes to WhatsApp/SMS *only when a provider is configured* (config flag in `config/services.php`, e.g. `services.messaging.driver`). When unconfigured, the external channel is omitted from `via()` (or no-ops), so in-app delivery always succeeds. Endpoints: `GET /notifications` (recipient's, paginated, unread filter), `POST /notifications/{id}/read` (mark read).

**Rationale**: Native notifications give the database table, `read_at`, and multi-channel `via()` for free (Constitution I). The provider hook is a single config-driven seam (YAGNI VII) — not a plugin framework. Decoupling external delivery means the unconfirmed provider decision does not block the phase.

**Alternatives considered**:
- *Custom notifications table + bespoke dispatch*: rejected — reinvents Laravel notifications.
- *Hard-wire a specific provider now*: rejected — provider is unconfirmed (spec assumption); would force rework.

---

## 9. Permissions model

**Decision**: New permission constants in `app/Support/MembershipPermissions.php` (mirroring `FoundationPermissions`): `members.{view,create,update,delete}`, `plans.{view,create,update,delete}`, `subscriptions.{view,create,renew,freeze,stop}`, `payments.{view,create}`, plus `notifications.view` and `dashboard.view` as needed. Seeded by `MembershipAccessSeeder` (idempotent `firstOrCreate`, clears Spatie cache), assigned to roles sensibly (Admin all; Manager most; Cashier sell/pay; Accountant payments/dues view). Enforced via **Policies** (`MemberPolicy`, etc.) called from controllers/Form Requests — not raw middleware strings only — so ownership/role logic is testable, though `permission:` middleware may back simple gates.

**Rationale**: Mirrors the established Phase 0 permission pattern; Policies satisfy Constitution II/V (authorization at the boundary, in Policies). Per-action granularity satisfies the spec's authorization-granularity edge case.

**Alternatives considered**:
- *Blanket role checks*: rejected — spec requires per-endpoint specific permissions.
- *Adding to `FoundationPermissions`*: rejected — Phase 0 doc says later phases add their own constants class.

---

## 10. Audit logging

**Decision**: Add Spatie `LogsActivity` to `Member`, `Plan`, `Subscription`, `Payment` (log relevant attributes, exclude none sensitive — these models hold no secrets, but never log raw uploads/PII beyond what's needed). Subscription lifecycle transitions and payment recording emit activity entries with the causer (current user).

**Rationale**: Constitution logging standards + spec FR-005/009/019/025. Reuses the Phase 0 activitylog config.

**Alternatives considered**:
- *Manual audit writes*: rejected — `LogsActivity` is already configured and idiomatic.

---

## Resolved unknowns summary

| Unknown (from Technical Context) | Resolution |
|----------------------------------|-----------|
| Effective end-date with freezes | §1 — store effective `end_date`, add days at freeze, cap by sum vs `max_freeze_days` |
| Renewal start-date rule | §2 — contiguous if unexpired, today if lapsed; always new row |
| Monetary precision approach | §3 — `decimal(10,2)` + `bcmath` |
| Payment "owed"/balance semantics | §4 — derive from `price_paid − SUM(amount)`; generic polymorphic table |
| Filtering/sorting mechanism | §5 — Spatie Query Builder, allowlisted |
| Photo access control (SEC-M3) | §6 — private disk + Policy-gated stream |
| Reminder lead time + idempotency | §7 — `settings.reminder_days`, once-per-day guard |
| External provider handling | §8 — native notifications + config-driven channel that no-ops |
| Permission granularity | §9 — `MembershipPermissions` + Policies |
