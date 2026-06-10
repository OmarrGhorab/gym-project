# Phase 1 — Members, Subscriptions & Plans

---

## 1. Objective
Build the membership lifecycle — the heart of the gym system. Members, the plans/offers they buy, and subscriptions with their full lifecycle (**new / renew / freeze / stop**), plus payment & dues tracking and automated renewal reminders.

## 2. Scope
### In scope
- Members CRUD (+ photo).
- Plans/Offers CRUD with validity windows and freeze limits.
- Subscriptions: create, renew, freeze/unfreeze, stop; status engine.
- Payments (polymorphic) with partial/dues handling.
- Renewal reminder automation (scheduled command + queued jobs + in-app realtime; WhatsApp/SMS channel hook).
- First dashboard widgets (active subscriptions, expiring soon).

### Out of scope (handled later)
- Product/POS sales → Phase 2 (but the **payments** infrastructure built here is reused there).
- Commission computation & employee entities → Phase 3 (this phase only **captures `sold_by_user_id`**).
- Full export/audit surfacing & final permission matrix → Phase 4.

## 3. Prerequisites (depends on Phase 0)
- Auth (`auth:sanctum`) + permissions framework.
- Base layout/RTL + shared UI components.
- `settings` (renewal lead-time), queue + scheduler, realtime channel, storage disk.

## 4. Deliverables
1. Full member management with photo upload.
2. Plan/offer management with active toggle and validity.
3. Subscription lifecycle (new/renew/freeze/stop) with correct effective end-date.
4. Payment recording with partial payments and a dues view.
5. Automated renewal reminders firing in-app (and via WhatsApp/SMS if provider confirmed).

## 5. Detailed Tasks

### 5.1 Backend
- **Members:** model, migration, `MemberResource`, `StoreMemberRequest`/`UpdateMemberRequest`, controller, policy, factory, seeder; photo upload to storage/R2.
- **Plans:** model + CRUD; fields: `type (membership|offer)`, `price`, `duration_days`, `sessions_count?`, `valid_from`, `valid_to`, `max_freeze_days`, `is_active`; toggle endpoint.
- **Subscriptions** (Actions pattern):
  - `CreateSubscriptionAction` — set `start_date`/`end_date` from plan duration, link `member` + `plan` + `sold_by_user_id` (current user), create a `payment`.
  - `RenewSubscriptionAction` — create a **new** subscription row (history preserved).
  - `FreezeSubscriptionAction` — write a `subscription_freezes` row, recompute effective `end_date (+frozen days)`, set `status=frozen`; enforce `max_freeze_days`.
  - `UnfreezeSubscriptionAction` — resume, set `status=active`.
  - `StopSubscriptionAction` — set `status=stopped`.
  - **Status engine:** scheduled command to expire subscriptions past `end_date` (`status=expired`).
- **Payments (polymorphic):** `payments(payable_type, payable_id, amount, method, status[paid|partial|due], paid_at, due_date)`; record full/partial payment; dues listing.
- **Renewal reminders:**
  - Scheduled daily command: find subscriptions expiring within `settings.reminder_days` (e.g. 3/7).
  - Dispatch queued notification jobs → in-app (Reverb/Pusher) + WhatsApp/SMS channel (provider hook).
  - `notifications` table; mark-as-read endpoint.
- **Permissions:** register `members.*`, `plans.*`, `subscriptions.*`, `payments.*`.
- **Audit:** add `LogsActivity` to Member, Subscription, Payment, Plan.
- **Tests:** subscription lifecycle (freeze recompute, renew history), partial payment dues, reminder command.

### 5.2 Frontend
- `/members` — list (search + status filter + pagination), create/edit form, **member profile** (subscriptions history, payments, dues).
- `/plans` — list + create/edit + active toggle.
- **Subscription actions** — new (from member profile or plan), renew/freeze/unfreeze/stop modals.
- **Payments UI** — record payment (full/partial), mark due, dues view.
- **In-app notifications** — realtime renewal alerts (wire Reverb/Pusher client + bell/inbox).
- **Dashboard widgets** — active subscriptions, expiring-soon list (basic).

## 6. Database (tables introduced / modified)
| Table | Key columns |
|---|---|
| `members` | id, name, phone, email, gender, birth_date, photo, national_id, join_date, status, notes, created_by |
| `plans` | id, name, description, price, duration_days, sessions_count?, type, is_active, valid_from, valid_to, max_freeze_days |
| `subscriptions` | id, member_id, plan_id, start_date, end_date, status[active/expired/frozen/stopped], price_paid, discount, **sold_by_user_id (FK users)**, created_by |
| `subscription_freezes` | id, subscription_id, freeze_start, freeze_end, days, reason, created_by |
| `payments` | id, payable_type, payable_id (morphs), amount, method, status[paid/partial/due], paid_at, due_date, created_by |
| `notifications` | (Laravel notifications) id, type, notifiable, data(json), read_at |

> **Phasing note:** `sold_by_user_id` references **users** (not `employees`) on purpose — the `employees` entity arrives in Phase 3 and links back via `employees.user_id`. This avoids a forward dependency and keeps Phase 1 self-contained.

## 7. API Endpoints
| Method | Endpoint |
|---|---|
| GET / POST | `/members` |
| GET / PUT / DELETE | `/members/{id}` |
| POST | `/members/{id}/photo` |
| GET | `/members/{id}/payments` |
| GET / POST | `/plans` |
| PUT | `/plans/{id}` |
| PATCH | `/plans/{id}/toggle` |
| POST | `/subscriptions` |
| GET | `/subscriptions` · `/subscriptions/{id}` |
| POST | `/subscriptions/{id}/renew` · `/freeze` · `/unfreeze` · `/stop` |
| POST | `/payments` |
| GET | `/payments?status=due` |
| GET | `/notifications` |
| POST | `/notifications/{id}/read` |

## 8. Frontend Pages & Components
`/members` (list + form + profile), `/plans` (list + form), subscription action modals, payment modal + dues view, notification inbox, dashboard widgets (active subs, expiring soon).

## 9. Integration Contracts (exposed for later phases)
- **`payments` (polymorphic)** — introduced here; **Phase 2 reuses it** for `Sale` payments; **Phase 3 reads it** as the revenue source.
- **`sold_by_user_id` on subscriptions** — **Phase 3** computes captain commissions by mapping it to `employees.user_id`.
- **`subscriptions` data** — **Phase 3** uses it for commissions, revenue, active-member KPIs.
- **`notifications` + realtime channel pattern** — reused by Phase 2 (new-sale alerts) and Phase 3 (dashboards).
- **`settings.reminder_days`** — consumed here; managed via the Settings UI in Phase 4.

## 10. Acceptance Criteria (Definition of Done)
- [ ] Full CRUD for members incl. photo.
- [ ] Create plan/offer with validity + toggle active.
- [ ] Create subscription → payment recorded → `status=active`, `end_date` correct.
- [ ] Renew creates a new row; history visible on the member profile.
- [ ] Freeze recomputes `end_date`; unfreeze resumes; `max_freeze_days` enforced.
- [ ] Stop sets `status=stopped`; expiry command sets `expired`.
- [ ] Partial payment leaves a due; dues list is accurate.
- [ ] Renewal reminder fires (verified in-app + notification/activity log).
- [ ] Permissions enforced (`members.*`, `plans.*`, `subscriptions.*`, `payments.*`).

## 11. Demo Checklist
Register a member → sell a subscription → record a partial payment (creates a due) → freeze then renew → trigger the reminder command and see the in-app alert.

## 12. Notes
- Confirm the **notification provider** (WhatsApp Cloud API vs SMS) — affects the channel implementation.
- Effective end-date math with freezes is the trickiest logic here — cover it with tests.
- Keep `payments` generic now; a sloppy schema here forces rework in Phases 2–3.
