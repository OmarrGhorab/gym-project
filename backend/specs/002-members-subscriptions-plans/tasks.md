# Tasks: Members, Subscriptions & Plans (Phase 1)

**Input**: Design documents from `/specs/002-members-subscriptions-plans/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: Required by the Constitution (Test-First with Pest). Write the failing Pest test first, watch it fail, then implement to green.

**Organization**: Grouped by user story so each can be implemented and validated independently after the shared foundation. Run tooling with PHP 8.4 (`~/.config/herd-lite/bin/php`).

**Conventions**: Explicit `$fillable`; authorization in Policies; validation in Form Requests; logic in Actions (typed args, never the Request); responses via API Resources; all routes under `/api/v1`; eager-load to avoid N+1; index every FK/queried column; money as `decimal(10,2)` computed with `bcmath`.

---

## Phase 1: Setup (Shared Dependencies)

**Purpose**: No new packages — all required packages were installed in Phase 0. Verify and prepare.

- [ ] T001 Verify Phase 0 packages are present (sanctum, spatie/permission, spatie/activitylog, spatie/query-builder, pest) via `composer show`; no installs expected. Record nothing if clean.
- [ ] T002 Confirm the Laravel `notifications` table migration exists or generate it with `php artisan make:notifications-table` into `database/migrations/*_create_notifications_table.php` (do not run yet).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every story depends on. No story work begins until this is complete.

- [ ] T003 Run and record the pre-implementation architecture review (`laravel-architecture-reviewer`) in `specs/002-members-subscriptions-plans/reviews/architecture.md`.
- [ ] T004 Create membership permission/role constants in `app/Support/MembershipPermissions.php` (members.*, plans.*, subscriptions.*, payments.*, notifications.view, dashboard.view), mirroring `app/Support/FoundationPermissions.php`.
- [ ] T005 Create `database/seeders/MembershipAccessSeeder.php` registering the new permissions (idempotent `firstOrCreate`, clear Spatie cache) and assigning them to roles (Admin all; Manager most; Cashier sell/pay; Accountant payments/dues view).
- [ ] T006 Wire `MembershipAccessSeeder` into `database/seeders/DatabaseSeeder.php` after `FoundationAccessSeeder` (no business seed data).
- [ ] T007 [P] Apply PERF-1 carry-in: eager-load `roles`/`permissions` where `UserResource` renders in collections (`app/Http/Resources/UserResource.php` docblock + `loadMissing` at render sites) so embedding the selling user in subscription lists is not 1+N.
- [ ] T008 [P] Apply SEC-M3 carry-in decision: ensure member photos use a private disk served via an authorized stream (no public `serve` exposure) — document the chosen disk in `config/filesystems.php` usage; actual stream route lands in US1.
- [ ] T009 Add `subscriptionsSold()` (hasMany Subscription via `sold_by_user_id`) relation to `app/Models/User.php` without altering `$fillable`/`$hidden`/casts.

**Checkpoint**: Permissions seeded, role assignments ready, User relations + PERF-1/SEC-M3 prerequisites in place.

---

## Phase 3: User Story 1 - Manage Members (Priority: P1) MVP

**Goal**: Staff can create, search/list, read, update, deactivate members and manage photos.

**Independent Test**: Create a member, list with search+status filter, update, upload+stream a photo, deactivate — with 401/403/422/404 paths enforced.

### Tests for US1

- [ ] T010 [P] [US1] Failing feature tests for member list (search, status filter, pagination, 200/401/403) in `tests/Feature/Api/V1/Members/MemberIndexTest.php`.
- [ ] T011 [P] [US1] Failing feature tests for member create (201, 422 invalid/duplicate, 403) in `tests/Feature/Api/V1/Members/MemberStoreTest.php`.
- [ ] T012 [P] [US1] Failing feature tests for member show/update/deactivate (200/404/422/403) in `tests/Feature/Api/V1/Members/MemberUpdateTest.php`.
- [ ] T013 [P] [US1] Failing feature tests for photo upload + Policy-gated stream (200, 422 bad type/size, 403) in `tests/Feature/Api/V1/Members/MemberPhotoTest.php`.
- [ ] T014 [P] [US1] Failing feature test for `GET /members/{id}/payments` (200, eager-loaded, paginated) in `tests/Feature/Api/V1/Members/MemberPaymentsTest.php`.

### Implementation for US1

- [ ] T015 [US1] Create `members` migration per data-model (columns, indexes, FK `created_by` set null) in `database/migrations/*_create_members_table.php`.
- [ ] T016 [US1] Create `app/Models/Member.php` (explicit `$fillable`, casts, `LogsActivity`, relations: subscriptions, creator).
- [ ] T017 [P] [US1] Create `database/factories/MemberFactory.php`.
- [ ] T018 [P] [US1] Create `app/Policies/MemberPolicy.php` (viewAny/view/create/update/delete mapped to `members.*`).
- [ ] T019 [P] [US1] Create `app/Http/Requests/Members/StoreMemberRequest.php` and `UpdateMemberRequest.php` (authorize via Policy; validation incl. photo mime/size, unique email/national_id).
- [ ] T020 [P] [US1] Create `app/Http/Resources/MemberResource.php` (envelope-compatible; optional embedded subscriptions/dues summary).
- [ ] T021 [US1] Create Actions in `app/Actions/Members/`: `StoreMember`, `UpdateMember`, `DeactivateMember`, `StoreMemberPhoto` (transactional photo path persistence).
- [ ] T022 [US1] Create `app/Http/Controllers/Api/V1/MemberController.php` (index with Spatie Query Builder filters/sorts, store, show, update, destroy, photo upload, photo stream, payments).
- [ ] T023 [US1] Register member routes under `/api/v1` in `routes/api.php` (auth:sanctum + `permission:`/Policy; write routes throttled).
- [ ] T024 [US1] Document member endpoints in `specs/002-members-subscriptions-plans/contracts/api.md` (sync any drift).
- [ ] T025 [US1] Run focused US1 tests; all green.

**Checkpoint**: Members fully functional and independently testable (MVP slice).

---

## Phase 4: User Story 2 - Manage Plans & Offers (Priority: P1)

**Goal**: Create/edit plans with validity + freeze allowance; toggle active; reject sale against invalid plans.

**Independent Test**: Create a plan, edit, toggle inactive, confirm inactive/expired plan is rejected at subscription creation.

### Tests for US2

- [ ] T026 [P] [US2] Failing feature tests for plan list/create (200/201/422 incl. valid_to<valid_from, max_freeze_days>duration, 403) in `tests/Feature/Api/V1/Plans/PlanStoreTest.php`.
- [ ] T027 [P] [US2] Failing feature tests for plan update + toggle (200, state flip, 403/404) in `tests/Feature/Api/V1/Plans/PlanToggleTest.php`.

### Implementation for US2

- [ ] T028 [US2] Create `plans` migration per data-model (indexes on type/is_active) in `database/migrations/*_create_plans_table.php`.
- [ ] T029 [US2] Create `app/Models/Plan.php` (explicit `$fillable`, casts price decimal:2/is_active bool/dates, `LogsActivity`, `subscriptions` relation, `isSellable()` helper).
- [ ] T030 [P] [US2] Create `database/factories/PlanFactory.php` (+ states: active, inactive, expired-window).
- [ ] T031 [P] [US2] Create `app/Policies/PlanPolicy.php` (`plans.*`).
- [ ] T032 [P] [US2] Create `app/Http/Requests/Plans/StorePlanRequest.php` and `UpdatePlanRequest.php` (validity + freeze-cap rules).
- [ ] T033 [P] [US2] Create `app/Http/Resources/PlanResource.php`.
- [ ] T034 [US2] Create Actions `app/Actions/Plans/StorePlan.php`, `UpdatePlan.php`, `TogglePlanActive.php`.
- [ ] T035 [US2] Create `app/Http/Controllers/Api/V1/PlanController.php` (index/store/update/toggle).
- [ ] T036 [US2] Register plan routes in `routes/api.php`.
- [ ] T037 [US2] Document plan endpoints in `contracts/api.md`.
- [ ] T038 [US2] Run focused US2 tests; all green.

**Checkpoint**: Plans functional; sale-time validity available for US3.

---

## Phase 5: User Story 3 - Sell & Track Subscriptions (Priority: P1)

**Goal**: Sell a subscription (derive dates, record `sold_by_user_id`, create payment), list/show, renew (new row, history).

**Independent Test**: Sell against an active plan → `active`, `end_date = start + duration`, selling user recorded, payment linked. Renew → new row, original preserved.

### Tests for US3

- [ ] T039 [P] [US3] Failing unit tests for `CreateSubscriptionAction` end-date derivation + payment creation + plan/member validity in `tests/Unit/Actions/Subscriptions/CreateSubscriptionTest.php`.
- [ ] T040 [P] [US3] Failing unit tests for `RenewSubscriptionAction` start-date rule (contiguous vs today) + history preservation in `tests/Unit/Actions/Subscriptions/RenewSubscriptionTest.php`.
- [ ] T041 [P] [US3] Failing feature tests for create/list/show (201/200/422 invalid plan/member/401/403, paginated, no N+1) in `tests/Feature/Api/V1/Subscriptions/SubscriptionStoreTest.php`.
- [ ] T042 [P] [US3] Failing feature test for renew endpoint (201 new row, history in member profile) in `tests/Feature/Api/V1/Subscriptions/SubscriptionRenewTest.php`.

### Implementation for US3

- [ ] T043 [US3] Create `subscriptions` migration per data-model (FKs member cascade, plan restrict, sold_by_user_id→users set null, indexes incl. composite (status,end_date)) in `database/migrations/*_create_subscriptions_table.php`.
- [ ] T044 [US3] Create `app/Models/Subscription.php` (explicit `$fillable` excluding server-set fields from raw binding, casts, `LogsActivity`, relations: member, plan, soldBy, freezes, payments morphMany).
- [ ] T045 [P] [US3] Create `database/factories/SubscriptionFactory.php` (states: active, expiring-soon, expired, frozen, stopped).
- [ ] T046 [P] [US3] Create `app/Policies/SubscriptionPolicy.php` (`subscriptions.*` incl. renew/freeze/stop abilities).
- [ ] T047 [P] [US3] Create `app/Http/Requests/Subscriptions/StoreSubscriptionRequest.php` and `RenewSubscriptionRequest.php`.
- [ ] T048 [P] [US3] Create `app/Http/Resources/SubscriptionResource.php` (eager-load member/plan/soldBy+roles per PERF-1).
- [ ] T049 [US3] Create `app/Actions/Subscriptions/CreateSubscription.php` (derive dates, set status active, record sold_by_user_id, compute price_paid, create payment via RecordPayment) and `RenewSubscription.php` (new row per research §2).
- [ ] T050 [US3] Create `app/Http/Controllers/Api/V1/SubscriptionController.php` (index/store/show/renew).
- [ ] T051 [US3] Register subscription create/list/show/renew routes in `routes/api.php` (write routes throttled).
- [ ] T052 [US3] Document subscription endpoints in `contracts/api.md`.
- [ ] T053 [US3] Run focused US3 tests; all green.

**Checkpoint**: Subscriptions can be sold and renewed with correct dates and history.

---

## Phase 6: User Story 4 - Freeze, Unfreeze & Stop (Priority: P1)

**Goal**: Freeze (bounded by max_freeze_days, recompute end date), unfreeze (resume), stop. Reject invalid transitions.

**Independent Test**: Freeze N days → `frozen`, end_date +N, freeze row; unfreeze → `active`, end date unchanged; exceed cap → 422; stop → `stopped`.

### Tests for US4

- [ ] T054 [P] [US4] Failing unit tests for `FreezeSubscriptionAction` end-date math + cumulative cap enforcement (the highest-risk logic) in `tests/Unit/Actions/Subscriptions/FreezeSubscriptionTest.php`.
- [ ] T055 [P] [US4] Failing unit tests for unfreeze/stop transitions + invalid-status guards in `tests/Unit/Actions/Subscriptions/SubscriptionTransitionsTest.php`.
- [ ] T056 [P] [US4] Failing feature tests for freeze/unfreeze/stop endpoints (200/422 cap exceeded/invalid status, 403) in `tests/Feature/Api/V1/Subscriptions/SubscriptionLifecycleTest.php`.

### Implementation for US4

- [ ] T057 [US4] Create `subscription_freezes` migration per data-model (FK cascade, index) in `database/migrations/*_create_subscription_freezes_table.php`.
- [ ] T058 [US4] Create `app/Models/SubscriptionFreeze.php` (explicit `$fillable`, `subscription` relation).
- [ ] T059 [P] [US4] Create `database/factories/SubscriptionFreezeFactory.php`.
- [ ] T060 [P] [US4] Create `app/Http/Requests/Subscriptions/FreezeSubscriptionRequest.php` (freeze_start/end, reason).
- [ ] T061 [P] [US4] Create `app/Http/Resources/SubscriptionFreezeResource.php`.
- [ ] T062 [US4] Create Actions `app/Actions/Subscriptions/FreezeSubscription.php` (insert freeze, cap check vs SUM(days), add days to end_date, status frozen), `UnfreezeSubscription.php`, `StopSubscription.php` (with status guards).
- [ ] T063 [US4] Add freeze/unfreeze/stop methods to `app/Http/Controllers/Api/V1/SubscriptionController.php`.
- [ ] T064 [US4] Register freeze/unfreeze/stop routes in `routes/api.php`.
- [ ] T065 [US4] Document lifecycle endpoints in `contracts/api.md`.
- [ ] T066 [US4] Run focused US4 tests; all green.

**Checkpoint**: Full subscription lifecycle works; freeze math proven by unit tests.

---

## Phase 7: User Story 5 - Record Payments & Track Dues (Priority: P1)

**Goal**: Polymorphic payments, full/partial, accurate dues, member payments, precision + overpay guards.

**Independent Test**: Partial payment → `partial` + remaining balance + appears in dues; pay remainder → cleared, off dues list; overpay → 422.

### Tests for US5

- [ ] T067 [P] [US5] Failing unit tests for `RecordPaymentAction` balance math (bcmath precision), status (paid/partial), overpayment rejection in `tests/Unit/Actions/Payments/RecordPaymentTest.php`.
- [ ] T068 [P] [US5] Failing feature tests for `POST /payments` (201 partial/paid, 422 overpay/settled, 404, 403) in `tests/Feature/Api/V1/Payments/PaymentStoreTest.php`.
- [ ] T069 [P] [US5] Failing feature test for dues listing `GET /payments?status=due` (accurate balances, paginated) in `tests/Feature/Api/V1/Payments/DuesListTest.php`.

### Implementation for US5

- [ ] T070 [US5] Create polymorphic `payments` migration per data-model (morph index, status/due_date indexes, FK created_by) in `database/migrations/*_create_payments_table.php`.
- [ ] T071 [US5] Create `app/Models/Payment.php` (explicit `$fillable`, casts amount decimal:2/paid_at/due_date, `LogsActivity`, `payable` morphTo, creator relation).
- [ ] T072 [P] [US5] Create `database/factories/PaymentFactory.php` (states: paid, partial, due).
- [ ] T073 [P] [US5] Create `app/Policies/PaymentPolicy.php` (`payments.*`).
- [ ] T074 [P] [US5] Create `app/Http/Requests/Payments/StorePaymentRequest.php`.
- [ ] T075 [P] [US5] Create `app/Http/Resources/PaymentResource.php`.
- [ ] T076 [US5] Create `app/Actions/Payments/RecordPayment.php` (bcmath balance, set status, reject overpayment) and a dues query (scope or query object) used by member payments + dues list.
- [ ] T077 [US5] Create `app/Http/Controllers/Api/V1/PaymentController.php` (store, index with status filter); wire member payments endpoint (from US1 controller) to the dues query.
- [ ] T078 [US5] Register payment routes in `routes/api.php` (throttled writes).
- [ ] T079 [US5] Document payment endpoints in `contracts/api.md`.
- [ ] T080 [US5] Run focused US5 tests; all green.

**Checkpoint**: Payments + dues accurate to the cent; polymorphic table ready for Phase 2 reuse.

---

## Phase 8: User Story 6 - Automated Renewal Reminders (Priority: P2)

**Goal**: Scheduled reminder (settings.reminder_days) → queued notification job → in-app + provider hook; idempotent; scheduled expiry; notification list/read endpoints.

**Independent Test**: Seed in/out-of-window subscriptions; run reminder command → only in-window reminded, once; run expiry → only past-end active become expired; list/read notifications.

### Tests for US6

- [ ] T081 [P] [US6] Failing feature test for `ExpireSubscriptionsAction`/command (only past-end active → expired; frozen/stopped untouched) in `tests/Feature/Foundation/ExpireSubscriptionsTest.php`.
- [ ] T082 [P] [US6] Failing feature test for reminder command selection + idempotency (in-window only, no duplicate on re-run) + queued job dispatch in `tests/Feature/Foundation/RenewalReminderTest.php`.
- [ ] T083 [P] [US6] Failing feature test for provider-hook channel no-op when unconfigured (in-app still delivered) in `tests/Feature/Foundation/ReminderChannelTest.php`.
- [ ] T084 [P] [US6] Failing feature tests for `GET /notifications` + `POST /notifications/{id}/read` (own-only, unread filter, 404 foreign) in `tests/Feature/Api/V1/Notifications/NotificationTest.php`.

### Implementation for US6

- [ ] T085 [US6] Run the `notifications` migration (from T002) in `database/migrations/*_create_notifications_table.php`.
- [ ] T086 [US6] Create `app/Notifications/SubscriptionRenewalReminder.php` (`via()` = database + conditional provider channel; `toArray` payload no PII secrets).
- [ ] T087 [US6] Add a config-driven messaging provider flag in `config/services.php` (e.g. `messaging.driver`) that gates the external channel; safe default off.
- [ ] T088 [US6] Create `app/Actions/Reminders/FindExpiringSubscriptions.php` (reads `settings.reminder_days`, default 7) and `SendRenewalReminders.php`.
- [ ] T089 [US6] Create `app/Jobs/SendRenewalReminderJob.php` (queued per-subscription delivery; idempotency guard once-per-day).
- [ ] T090 [US6] Create `app/Actions/Subscriptions/ExpireDueSubscriptions.php` (status active + end_date<today → expired).
- [ ] T091 [US6] Create commands `app/Console/Commands/SendRenewalRemindersCommand.php` (`subscriptions:send-renewal-reminders`) and `ExpireSubscriptionsCommand.php` (`subscriptions:expire`).
- [ ] T092 [US6] Schedule both commands daily in `routes/console.php`.
- [ ] T093 [US6] Create `app/Http/Controllers/Api/V1/NotificationController.php` (index own + paginate, markRead) and `app/Http/Resources/NotificationResource.php`.
- [ ] T094 [US6] Register notification routes in `routes/api.php` (auth:sanctum, own-only).
- [ ] T095 [US6] Document reminder/notification endpoints + commands in `contracts/api.md`.
- [ ] T096 [US6] Run focused US6 tests; all green.

**Checkpoint**: Reminders fire once per in-window subscription; expiry correct; notifications retrievable/markable.

---

## Phase 9: User Story 7 - Foundation Dashboard Read Models (Priority: P3)

**Goal**: Active-subscriptions count + expiring-soon list.

**Independent Test**: With known data, active count matches; expiring-soon list = in-window subscriptions.

### Tests for US7

- [ ] T097 [P] [US7] Failing feature tests for `GET /dashboard/active-subscriptions` and `GET /dashboard/expiring-soon` (correct count/list, paginated, 403) in `tests/Feature/Api/V1/Dashboard/DashboardTest.php`.

### Implementation for US7

- [ ] T098 [US7] Create `app/Http/Controllers/Api/V1/DashboardController.php` (activeSubscriptions count; expiringSoon using settings.reminder_days, eager-loaded, paginated).
- [ ] T099 [US7] Register dashboard routes in `routes/api.php` (`dashboard.view`).
- [ ] T100 [US7] Document dashboard endpoints in `contracts/api.md`.
- [ ] T101 [US7] Run focused US7 tests; all green.

**Checkpoint**: Dashboard read models accurate.

---

## Phase 10: Polish & Cross-Cutting Quality Gates

**Purpose**: Validate the full Phase 1 against the mandatory workflow.

- [ ] T102 Update `specs/002-members-subscriptions-plans/quickstart.md` if any behavior drifted during implementation.
- [ ] T103 [P] Final sync of `specs/002-members-subscriptions-plans/contracts/api.md` to shipped behavior.
- [ ] T104 Run Pint and record result in `specs/002-members-subscriptions-plans/reviews/formatting.md`.
- [ ] T105 Run the full Pest suite and record result in `specs/002-members-subscriptions-plans/reviews/tests.md`.
- [ ] T106 Run `laravel-security-reviewer` and record findings in `specs/002-members-subscriptions-plans/reviews/security.md` (verify SEC-M3 photo gating, mass-assignment, server-set price/status/sold_by).
- [ ] T107 Run `laravel-performance-reviewer` and record findings in `specs/002-members-subscriptions-plans/reviews/performance.md` (N+1 on subscription/member lists, indexes, queued reminders).
- [ ] T108 Run `laravel-code-reviewer` and record findings in `specs/002-members-subscriptions-plans/reviews/code-review.md`.
- [ ] T109 Run `release-readiness-auditor` and record verdict in `specs/002-members-subscriptions-plans/reviews/release-readiness.md`.

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → **Foundational (P2)** block everything.
- **US1 Members (P3)**: depends on Foundational. MVP.
- **US2 Plans (P4)**: depends on Foundational; independent of US1.
- **US3 Subscriptions (P5)**: depends on US1 (member) + US2 (plan) + US5's `RecordPayment` (payment on create) — implement `payments` table/Action early or stub create-payment then wire in US5. Recommended: build US5's migration+model+RecordPayment before US3's create-payment step.
- **US4 Freeze/Stop (P6)**: depends on US3 (subscriptions exist).
- **US5 Payments (P7)**: depends on US3 subscription (payable); migration/model can land before US3 create-payment.
- **US6 Reminders (P8)**: depends on US3 (subscriptions) + notifications table.
- **US7 Dashboard (P9)**: depends on US3.
- **Polish (P10)**: depends on all stories.

> **Note on US3↔US5 coupling**: `CreateSubscription` creates a payment, so the `payments` table + `RecordPayment` (US5 T070–T076) are a practical prerequisite for US3's payment step (T049). Sequence the `payments` foundation before US3's payment wiring.

### Within each story
- Tests first (fail) → migration → model/factory → policy/request/resource → action → controller → routes → docs → focused tests green.

---

## Parallel Opportunities

- **Foundational**: T007, T008 parallel after T004–T006.
- **US1 tests**: T010–T014 parallel; impl T017/T018/T019/T020 parallel after T015–T016.
- **US2 tests**: T026–T027 parallel; impl T030/T031/T032/T033 parallel after T028–T029.
- **US3 tests**: T039–T042 parallel; impl T045/T046/T047/T048 parallel after T043–T044.
- **US4 tests**: T054–T056 parallel; impl T059/T060/T061 parallel after T057–T058.
- **US5 tests**: T067–T069 parallel; impl T072/T073/T074/T075 parallel after T070–T071.
- **US6 tests**: T081–T084 parallel.
- **Cross-story parallelism**: US1 and US2 are fully independent and can be built by two agents concurrently. US5's payments foundation (T070–T076) can be built concurrently with US1/US2.

### Multi-agent track suggestion
- **Track A (sequential dependency spine)**: Foundational → US5 payments foundation → US3 → US4 → US6 → US7.
- **Track B (parallel, independent)**: US1 Members, US2 Plans.
Disjoint file ownership: Track B owns `Members/`, `Plans/` namespaces + their migrations/tests; Track A owns `Subscriptions/`, `Payments/`, `Reminders/`, `Notifications/`, `Dashboard/`. Shared files (`routes/api.php`, `DatabaseSeeder.php`, `contracts/api.md`) are edited by one track or merged carefully.

---

## Implementation Strategy

### MVP first
1. Setup + Foundational.
2. US1 Members → validate member CRUD + photo (the MVP slice).

### Incremental delivery
US1 → US2 → (payments foundation) → US3 → US4 → US5 (complete) → US6 → US7 → Polish. Each story is independently testable at its checkpoint.

### Mandatory workflow mapping
1. Analyze requirements: spec/plan/research (done). 2. Architecture review: T003. 3. Implement test-first: T010–T101. 4. Run tests: T105. 5. Security: T106. 6. Performance: T107. 7. Code review + release audit: T108–T109.

## Notes
- `[P]` = distinct file, parallelizable once dependencies are met. `[US#]` maps to spec user stories.
- Every endpoint preserves `/api/v1` + the envelope; money is decimal+bcmath; server sets price/status/sold_by_user_id (never client).
- No frontend tasks (CLAUDE.md). No new packages.
