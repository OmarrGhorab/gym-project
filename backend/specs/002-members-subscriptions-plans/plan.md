# Implementation Plan: Members, Subscriptions & Plans

**Branch**: `002-members-subscriptions-plans` (working on `main`) | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Backend-only Phase 1 from `phases/Phase-1-Members-Subscriptions-Plans.md`, building on the delivered Phase 0 foundation. Excludes all Next.js/dashboard/frontend work.

## Summary

Build the membership lifecycle on top of the Phase 0 foundation: **Members** (CRUD + photo), **Plans/Offers** (CRUD + active toggle + validity windows + freeze limits), **Subscriptions** (create/renew/freeze/unfreeze/stop with a status engine and correct freeze-aware end-date math), **polymorphic Payments** (full/partial/dues), **automated renewal reminders** (scheduled command → queued notification jobs → in-app + provider-hook channel), and two **dashboard read models** (active count, expiring-soon).

The work uses Laravel-native features exhausted-first: Eloquent models + relations, Form Requests for validation, Policies for authorization, single-purpose Actions for business logic, API Resources for the response envelope, the scheduler + queue for automation, Spatie Permission for the new permission sets, Spatie Activitylog for audit, and Spatie Query Builder for list filtering/sorting. No new packages, no repository pattern, no speculative abstraction.

This plan preserves the two cross-phase contracts exactly: `sold_by_user_id` references `users` (not `employees`), and `payments` is polymorphic (`payable_type`/`payable_id`) and defined once here for reuse by Phase 2 and read by Phase 3.

## Technical Context

**Language/Version**: PHP 8.4+, Laravel 12 (existing project — do not reinitialize). Run tooling with the Herd PHP 8.4 binary (`~/.config/herd-lite/bin/php`); the default PATH `php` is 8.2 and fails the platform check.

**Primary Dependencies** (all already installed in Phase 0 — no additions): `laravel/sanctum` (auth), `spatie/laravel-permission` (RBAC), `spatie/laravel-activitylog` (audit), `spatie/laravel-query-builder` (list filtering/sorting), `pestphp/pest` (+ laravel plugin, tests). `maatwebsite/excel` and `barryvdh/laravel-dompdf` are installed but unused in this phase (Phase 4 export work).

**Storage/Data**: MySQL in production; SQLite in-memory under test (per `phpunit.xml`). New tables: `members`, `plans`, `subscriptions`, `subscription_freezes`, `payments`, `notifications`. Reuses Phase 0 `users`, `settings`, `activity_log`, `personal_access_tokens`, Spatie permission tables, `jobs`/`failed_jobs`.

**Testing**: Pest only (no PHPUnit-style classes for new tests). SQLite in-memory, `sync` queue, `array` cache/session. Test-first: write the failing test, watch it fail, implement to green.

**Target Platform**: Backend REST API only, under `/api/v1`.

**Performance Goals**: No N+1 (eager-load all relations rendered by Resources); every `where`/`join`/`order by`/FK column indexed; all collection endpoints paginated; reminder/notification delivery queued, never inline.

**Constraints**: Monetary values stored as `decimal` and computed with integer-minor-unit or `bcmath`/`Number` semantics — never binary floats. Freeze end-date math is the highest-risk logic and is unit-tested exhaustively. Reminder process must be idempotent per subscription per day.

**Scale/Scope**: 6 new tables, ~20 endpoints across 7 user stories, 1 scheduled reminder command + 1 scheduled expiry command (or one command with two responsibilities split into Actions), 1 queued notification job, ~5 Actions per lifecycle area.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — still PASS.*

| Principle | How this plan complies |
|-----------|------------------------|
| **I. Laravel-First** | Eloquent, Form Requests, Policies, API Resources, scheduler, queue, notifications, Spatie packages already adopted in Phase 0. No new package; no custom abstraction. Spatie Query Builder (already installed) handles filtering/sorting rather than hand-rolled query parsing. |
| **II. Thin Transport** | Controllers resolve a Form Request, authorize via Policy, call an Action, return a Resource. All lifecycle/payment/freeze logic lives in single-purpose Actions taking typed args (never the Request). |
| **III. Test-First Pest** | Every endpoint gets feature tests (happy/422/401/403/404); freeze math, renewal history, partial-payment dues, reminder selection, and expiry get unit tests. Written first. |
| **IV. Versioned Contract** | All routes under `/api/v1`. Reuses the Phase 0 `{ data, meta, message }` success envelope and `{ error: { code, message, details } }` error shape via `ApiResponse`/`WrapsApiResponse` and the `bootstrap/app.php` renderers. Pagination via Laravel paginator → `meta`. |
| **V. Security by Default** | Explicit `$fillable` on every model; `$hidden` where relevant; every endpoint `auth:sanctum` + a specific `members.*`/`plans.*`/`subscriptions.*`/`payments.*` permission via Policy; prices/status/`sold_by_user_id` derived server-side, never trusted from input; write endpoints rate-limited; photo uploads validated (mime/size); bindings only. |
| **VI. Performance** | Eager-load relations in Resources; index every FK and queried column (`member_id`, `plan_id`, `sold_by_user_id`, `status`, `end_date`, `payable_*`, `read_at`); paginate all lists; queue notification delivery; cache only if a hot path is proven (not speculative). |
| **VII. YAGNI** | No repository pattern; Actions over services-of-services; no interfaces with one implementation; the provider-hook is a single seam (a Notification channel / config switch), not a plugin framework. Frontend explicitly out of scope. |

**Gate Result**: **PASS**. No violations; Complexity Tracking is empty.

## Cross-Phase Contract Preservation (CLAUDE.md / Integration Map)

These are binding and verified in design:

1. **`sold_by_user_id`** on `subscriptions` is a FK to `users` (`on delete restrict`/`set null` per data-model), **never** to `employees`. Phase 3 links commissions via `employees.user_id`. No forward dependency introduced.
2. **`payments`** is polymorphic (`payable_type`, `payable_id`) and defined **once** here, with `status ∈ {paid, partial, due}`. Phase 2 attaches `Sale` as another payable; Phase 3 reads this table as the single revenue source. Payment logic must not be forked per-payable.
3. **`notifications` + realtime channel** pattern established here is reused by Phase 2/3. Uses Laravel's native notifications table shape.
4. **`settings.reminder_days`** is consumed (read) here; it is managed via the Settings UI in Phase 4.

## Phase 0 Carry-In Follow-ups (address as this phase lands)

- **PERF-1** (do before the first list endpoint renders users): eager-load `roles`/`permissions` for `UserResource` to avoid 1+N when subscriptions embed the selling user. Apply `with(['roles','permissions'])`/`loadMissing` where `UserResource` is rendered in a collection.
- **SEC-M3** (prerequisite before storing member photos): gate the storage disk serve route, or set `serve => false` and stream member photos through an authorized controller with a Policy. Member photos are the first private files in the system.
- **SEC-M1/M2**: add throttle to authenticated groups; re-key login throttle on `email|ip`. Fold in opportunistically.
- **QA-1**: add the missing `429` login feature test.

## Project Structure

### Documentation (this feature)

```text
specs/002-members-subscriptions-plans/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions & rationale
├── data-model.md        # Phase 1 output — entities, columns, indexes, transitions
├── quickstart.md        # Phase 1 output — runnable validation guide
├── contracts/
│   └── api.md           # Phase 1 output — endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist (already present)
└── tasks.md             # Phase 2 output — created by /speckit-tasks (NOT here)
```

### Source Code (repository root — additions only)

```text
app/
├── Actions/
│   ├── Members/            # StoreMember, UpdateMember, (De)ActivateMember, StoreMemberPhoto
│   ├── Plans/              # StorePlan, UpdatePlan, TogglePlanActive
│   ├── Subscriptions/      # CreateSubscription, RenewSubscription, FreezeSubscription,
│   │                       #   UnfreezeSubscription, StopSubscription, ExpireDueSubscriptions
│   ├── Payments/           # RecordPayment (full/partial), + dues query lives in a query/scope
│   └── Reminders/          # FindExpiringSubscriptions, SendRenewalReminders
├── Console/Commands/       # SendRenewalRemindersCommand, ExpireSubscriptionsCommand
├── Http/
│   ├── Controllers/Api/V1/ # Member, Plan, Subscription, Payment, Notification, Dashboard controllers
│   ├── Requests/           # Members/, Plans/, Subscriptions/, Payments/ Form Requests
│   └── Resources/          # MemberResource, PlanResource, SubscriptionResource,
│                           #   SubscriptionFreezeResource, PaymentResource, NotificationResource
├── Jobs/                   # SendRenewalReminderJob (queued per-subscription delivery)
├── Models/                 # Member, Plan, Subscription, SubscriptionFreeze, Payment
│                           #   (notifications use Laravel's DatabaseNotification)
├── Notifications/          # SubscriptionRenewalReminder (database + provider-hook channel)
├── Policies/               # MemberPolicy, PlanPolicy, SubscriptionPolicy, PaymentPolicy
└── Support/                # MembershipPermissions (constants, mirrors FoundationPermissions)

database/
├── factories/             # Member, Plan, Subscription, SubscriptionFreeze, Payment factories
├── migrations/            # 6 new tables (members, plans, subscriptions, subscription_freezes,
│                          #   payments, notifications)
└── seeders/               # MembershipAccessSeeder (registers members.*/plans.*/subscriptions.*/payments.*)

routes/
├── api.php                # Add /api/v1 member/plan/subscription/payment/notification/dashboard routes
└── console.php            # Schedule the two daily commands

tests/
├── Feature/Api/V1/        # Members/, Plans/, Subscriptions/, Payments/, Notifications/, Dashboard/
├── Feature/Foundation/    # reminder + expiry command tests
└── Unit/Actions/          # freeze math, renewal history, partial-payment dues, end-date computation
```

**Structure Decision**: Single Laravel project, extending the Phase 0 layout. Each business area gets an `Actions/<Area>/` namespace and a Policy, mirroring the established `Actions/Auth`, `Actions/Foundation`, `Actions/Settings` pattern. Permission constants follow the `FoundationPermissions` precedent in a new `MembershipPermissions` class (later phases add their own; they do not edit `FoundationPermissions`).

## Implementation Phasing (maps to spec user stories)

1. **Foundational** (blocking): `MembershipPermissions` constants, `MembershipAccessSeeder`, base relations on `User` (`subscriptionsSold`), SEC-M3 photo-serve decision, PERF-1 eager-load fix.
2. **US1 Members** (P1 MVP): model/migration/factory/policy/requests/resource/controller + photo upload + member sub-resources (subscriptions, payments).
3. **US2 Plans** (P1): model/migration/factory/policy/requests/resource/controller + toggle + validity/freeze validation.
4. **US3 Subscriptions create/list** (P1): model/migration/factory/policy + `CreateSubscriptionAction` (derives dates, records `sold_by_user_id`, creates payment) + `RenewSubscriptionAction` (new row, history) + list/show.
5. **US4 Freeze/unfreeze/stop** (P1): `subscription_freezes` + the four lifecycle Actions + freeze-math unit tests + status-guard validation.
6. **US5 Payments & dues** (P1): polymorphic `payments` + `RecordPayment` + dues listing + member payments + precision/overpay guards.
7. **US6 Reminders + expiry** (P2): two scheduled commands, queued job, `SubscriptionRenewalReminder` notification (database + provider-hook), notifications list/read endpoints, idempotency.
8. **US7 Dashboard read models** (P3): active-count + expiring-soon read endpoints.
9. **Polish**: docs sync (`contracts/api.md`, `quickstart.md`), Pint, full suite, security/performance/code/release reviews per the mandatory workflow.

## Review Gates (mandatory workflow — CLAUDE.md)

1. Analyze requirements against Phase 1 doc + Constitution. ✅ (this plan)
2. `laravel-architecture-reviewer` **before** writing code.
3. `laravel-feature-engineer` — test-first implementation.
4. Full Pest suite green.
5. `laravel-security-reviewer`.
6. `laravel-performance-reviewer`.
7. `laravel-code-reviewer` + `release-readiness-auditor` (final gate).

## Out of Scope

- All frontend: `/members`, `/plans`, profile pages, subscription/payment modals, notification inbox UI, dashboard widgets, realtime *client* wiring, RTL layout.
- Product/POS sales, products, inventory (Phase 2) — though `payments` is built reuse-ready here.
- Commission computation and the `employees` entity (Phase 3) — only `sold_by_user_id` is captured.
- Export/report generation and the final permission matrix (Phase 4).
- Selecting/configuring a concrete external messaging provider (WhatsApp/SMS) — the channel hook is built and safely no-ops when unconfigured.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
