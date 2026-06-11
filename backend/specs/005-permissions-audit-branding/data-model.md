# Phase 1 Data Model — Permissions Matrix, Audit, Export & Branding

**No new business tables are introduced.** This phase operates entirely on tables established in Phase 0 (`settings`, Spatie's `permissions`/`roles`/`model_has_roles`/`model_has_permissions`/`role_has_permissions`, and `activity_log`) plus the existing Phase 1–3 tables (read-only, for export). The only schema change is an **index-review migration**.

---

## 1. Existing tables consumed (no structural change)

### `permissions`, `roles`, `model_has_roles`, `role_has_permissions` (Spatie)
- **Read by**: `GET /permissions` (catalog), `GET /roles`.
- **Written by**: `RoleController` CRUD via `Actions/Roles/*` (custom roles), `UserRoleController` (assignment), `RoleMatrixSeeder` (preset composition).
- **Guard**: `web` (matches existing seeders).
- **Invariant (FR-008 lock-out guard)**: at least one user must always hold `roles.manage`. Enforced in `UpdateRole`/`DeleteRole`/`SyncUserRoles` Actions, not the DB.

### `settings` (Phase 0)
| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `key` | string, **unique** | dot-notation key |
| `value` | json (cast `array`) | scalar/array/object |
| timestamps | | |

- **Read by**: `GET /settings`, `Actions/Reminders/FindExpiringSubscriptions` (`reminder_days`), P2 receipts (`vat_rate`, `receipt_template`).
- **Written by**: `PUT /settings` → `UpdateSettings` → existing `StoreSetting` (upsert on `key`).
- **No migration change** — the flexible key→JSON store already fits all seven settings keys (D8).

### `activity_log` (Spatie activitylog)
| Column | Type | Used by audit viewer |
|---|---|---|
| `id` | bigint PK | |
| `log_name` | string nullable | optional filter |
| `description` | string | shown as the action |
| `subject_type` / `subject_id` | string / bigint (morph) | **filter** by subject alias |
| `causer_type` / `causer_id` | string / bigint (morph) | **filter** by causer |
| `properties` | json | changed attributes (non-sensitive only) |
| `event` | string nullable | created/updated/deleted |
| `created_at` | timestamp | **filter** by range, default sort `-created_at` |

- **Read by**: `GET /audit-logs`.
- **Written by**: existing `LogsActivity` traits on 11 models + newly added `SubscriptionFreeze`; curated Action-level entries for settings changes, role changes, and export requests (D4).

### Phase 1–3 business tables (read-only, for export)
`members`, `subscriptions`, `sales`, `payments`, `payroll`, plus the report aggregates (`expenses`, `commissions`, etc.) — exported via per-resource `Exports/*` classes reusing each module's existing `AllowedFilter` set. No structural change.

---

## 2. Schema change: index-review migration

`database/migrations/xxxx_add_indexes_to_activity_log.php` (additive, reversible):

- Verify Spatie's shipped indexes; add composite/secondary indexes for the viewer's filter+sort paths if missing:
  - `(log_name)` — present by default in recent Spatie; verify.
  - `(subject_type, subject_id)` — present by default; verify.
  - `(causer_type, causer_id)` — present by default; verify.
  - **`(created_at)`** and/or **`(causer_id, created_at)`** — likely missing; add to support causer-scoped date-range queries (SC-005) without a full scan.
- Plus any module column flagged by the performance pass as queried/ordered/FK-but-unindexed (top-up only; most were added in P1–P3).

**Reversibility**: `down()` drops exactly the indexes `up()` added (guard with existence checks since some may pre-exist from Spatie).

---

## 3. Conceptual entities (no new persistence)

### Permission (Spatie row)
- **Attributes**: `name` (e.g. `members.create`), `guard_name` (`web`).
- **Catalog source**: `PermissionMatrix::all()` aggregates the five `*Permissions` support classes; the API reads seeded `Permission` rows (so custom ones appear too), grouped by module prefix for the matrix UI.

### Role (Spatie row)
- **Attributes**: `name`, `guard_name`, related `permissions[]`.
- **Kinds**: built-in presets (Admin/Manager/Cashier/Captain/Accountant — `FoundationPermissions::ALL_ROLES`) and custom roles created via API.
- **State**: a role's permission set may change at any time; Spatie cache is forgotten on write so holders' access updates without re-login (FR-006).

### Setting (key→value)
- Seven curated keys (D8): `gym.name`, `gym.colors`, `gym.logo`, `reminder_days`, `currency`, `vat_rate`, `receipt_template`.
- **Validation rules** (in `UpdateSettingsRequest`):
  - `reminder_days`: integer, min:0.
  - `vat_rate`: numeric, between:0,100.
  - `currency`: string, size:3, in allowed ISO list.
  - `gym.name`: string, max:255.
  - `gym.colors.{primary,secondary,accent}`: regex hex.
  - `gym.logo`: image upload (mimes + max KB) or string reference.
  - `receipt_template`: string, max length.

### Audit Entry (activity_log row)
- **Read shape** (`AuditLogResource`): `id`, `action` (description/event), `subject` `{ type: alias, id }`, `causer` `{ id, name }` or `null` with `causer_type: "system"`, `changes` (non-sensitive `properties`), `created_at`.
- **Filters**: subject alias → FQCN map; causer id; date range (`from`/`to`, validated `from ≤ to`).

### Export Request (transient — no table)
- **Inputs**: `resource ∈ {members, subscriptions, sales, payments, payroll, reports}`, `format ∈ {xlsx, csv, pdf}`, resource filters (reused from the index).
- **Outcomes**: small → immediate download; large → `202` + handle, file at `storage/app/exports/{uuid}.{ext}` (private disk), retrieved via signed temporary URL; pruned after retention window.
- **Audit**: each request logs causer + resource + format; job failure logged + on `failed_jobs`.

---

## 4. New permission names introduced (`SystemPermissions`)

| Permission | Gate for |
|---|---|
| `roles.manage` | `/roles` CRUD, `/users/{id}/roles`, `/permissions` (read) |
| `settings.manage` | `GET/PUT /settings` |
| `audit.view` | `GET /audit-logs` |
| `export.members` | `GET /export/members` |
| `export.subscriptions` | `GET /export/subscriptions` |
| `export.sales` | `GET /export/sales` |
| `export.payments` | `GET /export/payments` |
| `export.payroll` | `GET /export/payroll` |
| `export.reports` | `GET /export/reports` |

Seeded into presets per the D3 matrix; `export.{resource}` granted to roles holding the resource's view permission (D5).

---

## 5. Relationships touched (additive only)

- `SubscriptionFreeze` gains `LogsActivity` (audit coverage; no column change).
- `User` — `$hidden` review to ensure `password`, `remember_token` never leak through any Resource (esp. if surfaced in `/users/{id}/roles` responses). No schema change.
- No foreign keys added or altered.
