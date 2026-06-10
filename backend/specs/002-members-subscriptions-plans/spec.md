# Feature Specification: Members, Subscriptions & Plans

**Feature Branch**: `002-members-subscriptions-plans`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "next up: Phase 1 (Members, Subscriptions, Plans) — phases/Phase-1-Members-Subscriptions-Plans.md."

> **Scope note**: This specification covers the **backend (REST API) scope only**, consistent with the Phase 0 foundation already delivered in this repository. Frontend pages, dashboard UI, RTL layout, and realtime client wiring described in the source phase document are out of scope here; this spec defines the API, data, business rules, and automation that the frontend will later consume. Realtime/notification delivery is specified at the API/event level (records produced, channel emitted), not as UI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Members (Priority: P1) MVP

A gym staff user can register a member, view and search the member roster, update member details, attach a member photo, and deactivate a member, so that every person who interacts with the gym has an accurate, findable record.

**Why this priority**: Members are the root entity of the entire phase — plans are sold *to* members, subscriptions belong *to* members, and payments/dues are read *per* member. No other story is usable without a member to attach it to. This is the MVP slice.

**Independent Test**: Authenticate as a permitted staff user, create a member, retrieve it in a paginated/searchable list, update a field, upload a photo, and deactivate the member — each returning the standard success envelope, with permission and validation paths enforced.

**Acceptance Scenarios**:

1. **Given** a staff user with `members.create` permission, **When** they submit valid member details, **Then** the member is created with status `active` and a recorded creator, and the response returns the member in the standard envelope.
2. **Given** existing members, **When** a permitted user lists members with a name/phone search term and a status filter, **Then** only matching members are returned, paginated, without unbounded results.
3. **Given** an existing member, **When** a permitted user uploads a photo within the allowed type/size limits, **Then** the photo is stored on the configured disk and the member record references it.
4. **Given** a member with related subscriptions/payments, **When** a permitted user requests that member's record, **Then** the response can include their subscription history and payment/dues summary without N+1 queries.
5. **Given** a user lacking the relevant `members.*` permission, **When** they attempt the action, **Then** the system returns `403` and makes no change.
6. **Given** invalid input (e.g., malformed phone, oversized photo, duplicate national id), **When** submitted, **Then** the system returns `422` with field-level errors and creates/changes nothing.

---

### User Story 2 - Manage Plans & Offers (Priority: P1)

A staff user can create and edit membership plans and offers — each with a price, duration, optional session count, validity window, and freeze allowance — and toggle a plan active/inactive, so that subscriptions can only be sold against well-defined, currently-valid products.

**Why this priority**: A subscription cannot be created without a plan to derive its price, duration, and freeze limits from. Plans must exist and be valid before Story 3 is meaningful. It is P1 because it is a hard prerequisite for the core revenue action.

**Independent Test**: Authenticate as a permitted user, create a plan with a validity window and freeze allowance, edit it, toggle it inactive, and confirm an inactive/expired plan is rejected when selling a subscription.

**Acceptance Scenarios**:

1. **Given** a permitted user, **When** they create a plan of type `membership` or `offer` with price, duration in days, optional sessions count, validity window, and max freeze days, **Then** the plan is stored and returned in the standard envelope.
2. **Given** an existing plan, **When** a permitted user toggles its active state, **Then** the plan's availability for new subscriptions flips accordingly and the change is reflected on read.
3. **Given** an inactive plan or a plan whose validity window does not include the current date, **When** a user attempts to sell a subscription against it, **Then** the system rejects the attempt with a validation error and sells nothing.
4. **Given** invalid plan input (e.g., negative price, `valid_to` before `valid_from`, freeze days exceeding duration), **When** submitted, **Then** the system returns `422` with field errors.

---

### User Story 3 - Sell & Track Subscriptions (Priority: P1)

A staff user can sell a subscription to a member against a plan — capturing who sold it and recording an initial payment — and the system derives the correct start and end dates from the plan, sets the subscription `active`, and preserves history when the member renews.

**Why this priority**: This is the core revenue and lifecycle action of the phase. It ties members, plans, the salesperson identity (`sold_by_user_id`), and payments together, and produces the data later phases consume for commissions and revenue. It is the central P1 of the phase.

**Independent Test**: Sell a subscription to a member against an active plan; verify status `active`, an end date equal to start date plus the plan's duration, the recording of the selling user, and a linked payment. Renew it and confirm a new subscription row exists with the prior one preserved as history.

**Acceptance Scenarios**:

1. **Given** an active member and a currently-valid active plan, **When** a permitted user creates a subscription, **Then** the system sets `start_date` to the effective start, computes `end_date` from the plan duration, sets status `active`, records `sold_by_user_id` as the current user, and creates a corresponding payment.
2. **Given** an existing subscription, **When** a permitted user renews it, **Then** a **new** subscription row is created (the original is retained as history) with dates derived from the renewal, and the member's profile shows both.
3. **Given** subscriptions exist, **When** a permitted user lists or filters them (by member, status, or date), **Then** results are paginated and eager-loaded without N+1.
4. **Given** a user lacking `subscriptions.*` permission, **When** they attempt to sell/renew, **Then** the system returns `403` and records nothing.
5. **Given** an attempt to subscribe against an inactive/expired plan or an inactive member, **When** submitted, **Then** the system returns `422` and creates no subscription or payment.

---

### User Story 4 - Freeze, Unfreeze & Stop Subscriptions (Priority: P1)

A staff user can freeze an active subscription for a bounded number of days (within the plan's allowance), unfreeze it to resume, or stop it permanently, and the system correctly recomputes the effective end date so frozen time is not lost.

**Why this priority**: Freeze/stop are core lifecycle operations members expect, and the freeze end-date math is the most error-prone logic in the phase (explicitly called out in the source document). Incorrect recomputation directly costs the business or the member money/time.

**Independent Test**: Freeze an active subscription for N days, confirm status `frozen` and a freeze record; unfreeze and confirm the end date has shifted forward by the frozen duration and status returns to `active`; attempt to exceed `max_freeze_days` and confirm rejection; stop a subscription and confirm status `stopped`.

**Acceptance Scenarios**:

1. **Given** an active subscription on a plan that allows freezing, **When** a permitted user freezes it for an allowed number of days, **Then** a freeze record is created, the subscription status becomes `frozen`, and the effective end date is extended by the frozen days.
2. **Given** a frozen subscription, **When** a permitted user unfreezes it, **Then** the status returns to `active` and the effective end date reflects the frozen days already added.
3. **Given** a freeze request whose days (alone or cumulatively) exceed the plan's `max_freeze_days`, **When** submitted, **Then** the system rejects it with `422` and changes nothing.
4. **Given** an active or frozen subscription, **When** a permitted user stops it, **Then** the status becomes `stopped` and it is excluded from active/expiring calculations.
5. **Given** a subscription that is already stopped or expired, **When** a user attempts to freeze it, **Then** the system rejects the action.

---

### User Story 5 - Record Payments & Track Dues (Priority: P1)

A staff user can record a full or partial payment against a subscription, and the system tracks the remaining balance so that partially-paid subscriptions appear in an accurate dues list until settled.

**Why this priority**: Payment and dues tracking is a core financial requirement and the polymorphic payment structure created here is a cross-phase contract (reused by Phase 2 sales, read by Phase 3 revenue). Getting it generic and correct now prevents costly rework later.

**Independent Test**: Record a partial payment against a subscription; confirm the payment is marked `partial` with a remaining balance and the subscription appears in the dues list; record the remainder; confirm it no longer appears as due.

**Acceptance Scenarios**:

1. **Given** a subscription with an owed amount, **When** a permitted user records a payment equal to the full amount, **Then** the payment is marked `paid` and the subscription shows no outstanding due.
2. **Given** a subscription with an owed amount, **When** a permitted user records a payment less than the amount owed, **Then** the payment reflects `partial` status with a remaining balance, and the subscription appears in the dues list.
3. **Given** outstanding dues, **When** a permitted user requests the dues list (filterable by status), **Then** the system returns paginated, accurate outstanding balances.
4. **Given** a member, **When** a permitted user requests that member's payments, **Then** all payments associated with the member's subscriptions are returned through the standard envelope.
5. **Given** an over-payment or a payment against a non-existent/forbidden subscription, **When** submitted, **Then** the system returns `422`/`403`/`404` as appropriate and records nothing.

---

### User Story 6 - Automated Renewal Reminders (Priority: P2)

The system automatically identifies subscriptions expiring within a configured lead time and generates renewal reminder notifications (delivered in-app, and routed to an external messaging channel where a provider is configured), so staff and members are prompted to renew before lapse. A scheduled process also marks subscriptions past their end date as expired.

**Why this priority**: Reminders and automatic expiry add significant operational value but depend on Stories 1–5 existing first. They are automation on top of the core lifecycle, hence P2.

**Independent Test**: Configure the reminder lead time, seed subscriptions expiring within and outside the window, run the reminder process, and confirm notifications are generated only for in-window subscriptions and recorded for in-app retrieval; run the expiry process and confirm only past-end-date subscriptions become `expired`.

**Acceptance Scenarios**:

1. **Given** a configured reminder lead time and subscriptions expiring within it, **When** the scheduled reminder process runs, **Then** a renewal reminder notification is generated for each in-window subscription and is retrievable in-app.
2. **Given** subscriptions expiring outside the lead-time window, **When** the reminder process runs, **Then** no reminder is generated for them.
3. **Given** a configured external messaging provider, **When** a reminder is generated, **Then** the system routes a message to that channel via a provider hook; **and given** no provider is configured, **Then** in-app delivery still succeeds and external delivery is safely skipped.
4. **Given** a recipient with unread notifications, **When** they list notifications and mark one as read, **Then** that notification reflects a read state and is excluded from unread counts.
5. **Given** subscriptions whose end date has passed and that are not frozen/stopped, **When** the scheduled expiry process runs, **Then** their status becomes `expired`; active, frozen, and stopped subscriptions are unaffected as appropriate.

---

### User Story 7 - Foundation Dashboard Read Models (Priority: P3)

A staff user can read summary figures for the membership business — the count of active subscriptions and a list of subscriptions expiring soon — so the future dashboard has accurate data to display.

**Why this priority**: These read models are valuable but purely derivative of Stories 1–6 and have no business logic of their own beyond aggregation. They are the lowest priority and can ship last.

**Independent Test**: With known subscription data, request the active-subscriptions count and the expiring-soon list and verify both match the underlying data and respect the configured lead time.

**Acceptance Scenarios**:

1. **Given** subscriptions in various statuses, **When** a permitted user requests the active-subscriptions summary, **Then** the returned count reflects only currently-active subscriptions.
2. **Given** subscriptions expiring within the configured lead time, **When** a permitted user requests the expiring-soon list, **Then** the list contains exactly those subscriptions, paginated and eager-loaded.

---

### Edge Cases

- **Freeze math**: overlapping or repeated freezes on the same subscription must accumulate against `max_freeze_days` and never let the cumulative frozen days exceed the allowance; the effective end date must equal the original end date plus total frozen days actually taken.
- **Renewal timing**: renewing before the current subscription ends vs. after it has expired — the new subscription's start date must follow a defined, documented rule (see Assumptions) rather than silently overlapping or leaving a gap.
- **Plan validity at sale time**: a plan that becomes inactive or whose validity window lapses between listing and sale must be re-validated at the moment of subscription creation.
- **Payment precision**: monetary amounts must avoid floating-point rounding errors; partial payments must sum exactly to the owed amount with no residual cent.
- **Over/duplicate payment**: paying more than owed, or re-paying a settled subscription, must be rejected rather than producing a negative or phantom due.
- **Member deactivation with obligations**: deactivating a member who has active subscriptions or outstanding dues must follow a defined rule (block, warn, or allow with retained obligations — see Assumptions) and must never orphan financial records.
- **Photo upload abuse**: non-image files, oversized files, or mismatched content types must be rejected; storage failures must not leave a half-written member record.
- **Reminder idempotency**: running the reminder process twice in the same window must not spam duplicate reminders for the same subscription/day.
- **Expiry vs. freeze race**: a frozen subscription past its *original* end date must not be auto-expired while still legitimately frozen.
- **Authorization granularity**: a user with `members.view` but not `members.update` must be able to read but not modify; every endpoint enforces its specific permission, not a blanket role.

## Requirements *(mandatory)*

### Functional Requirements

**Members**

- **FR-001**: The system MUST allow permitted users to create, read, update, and deactivate members, with a defined set of attributes (identity, contact, demographic, membership metadata, status, notes, and creator).
- **FR-002**: The system MUST provide a paginated member listing with search (by name/phone) and filtering (by status), never returning unbounded results.
- **FR-003**: The system MUST allow permitted users to upload a member photo of an allowed type and size, store it on the configured storage disk, and associate it with the member.
- **FR-004**: The system MUST expose a per-member view of their subscription history and their payments/dues.
- **FR-005**: The system MUST record who created/modified a member and MUST audit member changes.

**Plans**

- **FR-006**: The system MUST allow permitted users to create, read, and update plans/offers with: type (`membership` or `offer`), price, duration in days, optional session count, validity window (`valid_from`/`valid_to`), maximum freeze days, and an active flag.
- **FR-007**: The system MUST allow permitted users to toggle a plan's active state via a dedicated action.
- **FR-008**: The system MUST prevent selling a subscription against a plan that is inactive or outside its validity window at the time of sale.
- **FR-009**: The system MUST audit plan changes.

**Subscriptions**

- **FR-010**: The system MUST create a subscription that links a member, a plan, and the selling user (`sold_by_user_id` referencing the user account), deriving `start_date` and computing `end_date` from the plan's duration, and setting status `active`.
- **FR-011**: The system MUST create a payment as part of (or immediately following) subscription creation, capturing the agreed price, any discount, and the amount actually paid.
- **FR-012**: The system MUST implement renewal by creating a **new** subscription row while preserving the prior subscription as history (no in-place overwrite).
- **FR-013**: The system MUST support freezing an active subscription: recording a freeze period, setting status `frozen`, and extending the effective end date by the frozen days; the cumulative frozen days MUST NOT exceed the plan's `max_freeze_days`.
- **FR-014**: The system MUST support unfreezing a frozen subscription, returning status to `active` with the end date reflecting frozen days already added.
- **FR-015**: The system MUST support stopping a subscription, setting status `stopped` and excluding it from active/expiring calculations.
- **FR-016**: The system MUST provide a scheduled process that sets subscriptions past their effective end date (and not frozen/stopped) to status `expired`.
- **FR-017**: The system MUST provide paginated, filterable subscription listings and a single-subscription read, eager-loading related data used in responses.
- **FR-018**: The system MUST reject lifecycle transitions that are invalid for the current status (e.g., freezing a stopped/expired subscription).
- **FR-019**: The system MUST audit subscription lifecycle state changes.

**Payments & Dues**

- **FR-020**: The system MUST record payments against subscriptions using a polymorphic association (`payable_type`/`payable_id`) designed to be reused by other payable entities in later phases, with amount, method, status (`paid`/`partial`/`due`), paid-at, and due-date.
- **FR-021**: The system MUST support partial payments, tracking the remaining balance so the owed amount and payment status stay consistent.
- **FR-022**: The system MUST provide a dues listing filterable by status, returning accurate outstanding balances, paginated.
- **FR-023**: The system MUST reject overpayments and payments against settled/forbidden/non-existent subscriptions with the correct error status.
- **FR-024**: The system MUST treat monetary values with exact precision (no floating-point drift).
- **FR-025**: The system MUST audit payment records and state changes.

**Renewal Reminders & Notifications**

- **FR-026**: The system MUST provide a scheduled daily process that finds subscriptions expiring within a configurable lead time (sourced from settings) and generates a renewal reminder for each.
- **FR-027**: The system MUST deliver reminders in-app (persisted notifications retrievable by the recipient) and MUST dispatch the heavy/external delivery work to queued jobs rather than running it inline.
- **FR-028**: The system MUST route reminders to an external messaging channel (e.g., WhatsApp/SMS) through a provider hook when a provider is configured, and MUST safely no-op external delivery when none is configured — without failing in-app delivery.
- **FR-029**: The system MUST provide endpoints to list a recipient's notifications and to mark a notification as read.
- **FR-030**: The reminder process MUST be idempotent within a day/window so the same subscription is not reminded multiple times for the same window.

**Dashboard Read Models**

- **FR-031**: The system MUST expose a read model for the count of currently-active subscriptions.
- **FR-032**: The system MUST expose a paginated read model listing subscriptions expiring within the configured lead time.

**Cross-cutting (Constitution-mandated)**

- **FR-033**: Every endpoint MUST be versioned under `/api/v1`, return the standard success envelope (`{ data, meta, message }`), and emit the standard error structure with correct HTTP status codes (200/201/204, 401, 403, 404, 422, 429).
- **FR-034**: Every non-public endpoint MUST require authentication and MUST enforce a specific permission from the sets `members.*`, `plans.*`, `subscriptions.*`, `payments.*` (and the notification/dashboard equivalents).
- **FR-035**: The system MUST register the new permissions and make them assignable to roles, consistent with the Phase 0 permission framework.
- **FR-036**: Write-heavy and sensitive endpoints MUST be rate-limited.
- **FR-037**: Collection endpoints MUST be paginated and MUST eager-load relationships rendered in responses (no N+1).
- **FR-038**: All new endpoints' contracts (inputs, outputs, statuses, auth/permission) MUST be documented and kept in sync.

### Key Entities *(include if feature involves data)*

- **Member**: A person who interacts with the gym. Identity and contact details, demographic fields, optional photo, membership metadata (e.g., join date), status (active/inactive), notes, and the user who created the record. Owns subscriptions and (through them) payments.
- **Plan**: A sellable membership or offer. Carries pricing, duration (days), optional session count, type (`membership`/`offer`), an active flag, a validity window, and a maximum allowed freeze duration. Subscriptions derive their terms from a plan.
- **Subscription**: An instance of a member holding a plan over a date range. Links member, plan, and the selling user (`sold_by_user_id` → user). Carries start/end dates, status (`active`/`expired`/`frozen`/`stopped`), price paid, discount, and creator. Renewal produces a new subscription; history is preserved.
- **Subscription Freeze**: A bounded freeze period applied to a subscription (start, end, day count, reason, creator). Accumulates against the plan's freeze allowance and drives effective end-date recomputation.
- **Payment**: A polymorphic financial record attached to a payable (a subscription in this phase; other payables in later phases). Carries amount, method, status (`paid`/`partial`/`due`), paid-at, and due-date. The single source of recorded revenue across phases.
- **Notification**: A message to a recipient (e.g., a renewal reminder), with a type, payload, and read state, retrievable in-app and markable as read.
- **Setting (reminder lead time)**: An existing foundation setting (`reminder_days`) consumed by the reminder and expiring-soon logic; managed via the Settings surface in a later phase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff user can register a member and sell them a subscription against a valid plan — with an initial payment recorded — in a single, uninterrupted flow, and the resulting subscription shows status `active` with an end date exactly equal to the start date plus the plan's duration in 100% of valid attempts.
- **SC-002**: For any subscription frozen for N days, the effective end date increases by exactly N days and never by more or fewer; cumulative freezes are rejected the moment they would exceed the plan's freeze allowance, with zero incorrect extensions across the test suite.
- **SC-003**: Renewing a subscription always yields a new record while the previous record remains retrievable in the member's history, with no loss of prior subscriptions in any scenario.
- **SC-004**: A partial payment always leaves an outstanding balance equal to owed-minus-paid (to exact monetary precision), the subscription appears in the dues list while a balance remains, and disappears from it once fully paid — with no rounding residue.
- **SC-005**: When the reminder process runs, 100% of subscriptions expiring within the configured lead time receive exactly one in-app reminder for that window, and 0% of out-of-window subscriptions receive one; a missing external provider never prevents in-app reminders.
- **SC-006**: The scheduled expiry process marks only subscriptions past their effective end date (excluding frozen and stopped) as `expired`, with no false expirations of active or legitimately-frozen subscriptions.
- **SC-007**: Every endpoint enforces its specific permission: an authenticated user lacking the required permission receives `403` and effects no change in 100% of authorization tests, and unauthenticated requests receive `401`.
- **SC-008**: Every collection endpoint returns paginated results and renders related data without triggering per-row queries (no N+1) under test.
- **SC-009**: Every Phase 1 endpoint returns the standard success/error envelope with correct status codes, verified by feature tests covering happy-path, `422`, `401`, `403`, and `404` for each endpoint.
- **SC-010**: The full demo flow — register member → sell subscription → record a partial payment (creating a due) → freeze → renew → run the reminder process and observe the in-app alert — completes end to end against the API with every Acceptance Criterion in the source phase satisfied.

## Assumptions

- **Backend-only scope**: Per the repository's nature (`backend`) and CLAUDE.md ("Do not add Next.js, dashboard, RTL layout, or frontend implementation tasks"), this spec defines only the API/data/business/automation layer. Frontend pages and realtime *client* wiring are out of scope; realtime is specified as the server-side event/notification record and channel emission only.
- **`sold_by_user_id` references `users`**, not `employees` — deliberately, to avoid a forward dependency on Phase 3, exactly as stated in the integration map. The `employees` linkage and commission computation are Phase 3.
- **Payments are polymorphic from day one** (`payable_type`/`payable_id`) and must remain generic; Phase 2 (sales) and Phase 3 (revenue) reuse/read this same structure. No subscription-specific payment fork.
- **Reminder lead time** comes from the existing `settings` foundation as `reminder_days` (e.g., 3 or 7); the reminder and expiring-soon logic read it rather than hard-coding a value.
- **Renewal start-date rule** (default chosen, document in implementation): when renewing a subscription that has **not yet expired**, the new subscription starts the day after the current effective end date (no gap, no overlap); when renewing an **already-expired** subscription, the new subscription starts on the renewal date. The end date is start plus plan duration in both cases.
- **Effective end-date with freezes** = original end date + sum of frozen days actually taken, capped by the plan's `max_freeze_days`. This is the phase's most error-prone logic and is covered by dedicated unit tests.
- **Member deactivation** does not delete or orphan financial records: deactivating a member retains their subscriptions, payments, and dues for reporting; whether new subscriptions can be sold to an inactive member defaults to **blocked** (a subscription requires an active member).
- **Monetary precision** is handled with exact decimal semantics (not binary floats) to prevent cent-level drift in dues.
- **External messaging provider** (WhatsApp Cloud API vs. SMS) is **not yet confirmed**; the reminder system ships with an in-app channel plus a provider-hook seam that safely no-ops when unconfigured. Selecting/enabling a concrete provider is a later decision and does not block this phase.
- **Realtime delivery channel** (e.g., Reverb/Pusher) follows the Phase 0 broadcast-readiness configuration; this phase emits the notification/event, with the client subscription handled by the frontend later.
- **Authentication, permissions framework, response envelope, queue/scheduler, storage disk, and settings** are all provided by the delivered Phase 0 foundation and are reused, not rebuilt.
- **Photo storage** uses the configured storage disk (local/remote per Phase 0 filesystem config); allowed types and max size use sensible image defaults unless specified otherwise.

## Dependencies

- **Phase 0 Foundation (delivered)**: Sanctum auth, Spatie roles/permissions, activity-log/audit, response envelope, `/api/v1` structure, queue + scheduler, storage disk, broadcast readiness, and the `settings` store. This phase builds directly on those.
- **Phase 0 deferred follow-ups relevant here** (carry-ins to address as this phase lands): PERF-1 (eager-load roles/permissions on the user resource before list endpoints render users in collections), SEC-M3 (gate the storage disk serve route before any private files — relevant to member photos), SEC-M1/M2 (auth throttling), and QA-1 (429 login test).

## Out of Scope

- Product/POS sales (Phase 2) — though the polymorphic `payments` structure built here is the one Phase 2 reuses.
- Commission computation and the `employees` entity (Phase 3) — this phase only captures `sold_by_user_id`.
- Full export/audit surfacing and the final permission matrix (Phase 4).
- All frontend pages, dashboard UI, RTL layout, and realtime client wiring.
- Selecting and configuring a concrete external messaging provider (the hook is built; the provider choice is deferred).
