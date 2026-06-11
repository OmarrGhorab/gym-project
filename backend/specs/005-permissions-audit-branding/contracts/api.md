# API Contracts — Permissions Matrix, Audit, Export & Branding

All routes are under `/api/v1`, require `auth:sanctum`, and return the standard envelope:
`{ "data": ..., "meta": {...}, "message": "..." }` on success; `{ "error": { "code", "message", "details" } }` on failure. Status codes follow the Constitution (200/201/204, 401, 403, 404, 422, 429).

Permissions referenced map to `SystemPermissions` (new) and the existing `*Permissions` classes.

---

## Permissions & Roles

### `GET /api/v1/permissions`
- **Auth/Perm**: `auth:sanctum` + `permission:roles.manage`.
- **Purpose**: full permission catalog, grouped by module.
- **200**: `data` = `{ "members": ["members.view", ...], "sales": [...], "system": ["roles.manage", "settings.manage", "audit.view", "export.members", ...], ... }`.
- **403**: caller lacks `roles.manage`.

### `GET /api/v1/roles`
- **Perm**: `permission:roles.manage`.
- **200**: `data` = array of `RoleResource` `{ id, name, permissions: [name...], is_preset: bool }`, paginated meta.

### `POST /api/v1/roles`
- **Perm**: `permission:roles.manage`; **throttle**: `api`.
- **Body** (`StoreRoleRequest`): `{ "name": "string unique", "permissions": ["members.view", ...] }` — each permission must exist in the catalog.
- **201**: created `RoleResource`. **422**: duplicate name / unknown permission. **403**: lacks perm.

### `PUT /api/v1/roles/{role}`
- **Perm**: `permission:roles.manage`.
- **Body** (`UpdateRoleRequest`): `{ "name"?, "permissions": [...] }` — `syncPermissions`.
- **200**: updated `RoleResource`. **422**: would remove the last `roles.manage` holder (lock-out guard) or unknown permission. **404**: role missing.

### `DELETE /api/v1/roles/{role}`
- **Perm**: `permission:roles.manage`.
- **204**: deleted. **422**: deleting would orphan users from all `roles.manage` access (lock-out guard) or role is an undeletable preset. **404**: missing.

### `POST /api/v1/users/{user}/roles`
- **Perm**: `permission:roles.manage`; **throttle**: `api`.
- **Body** (`SyncUserRolesRequest`): `{ "roles": ["Admin", "Cashier"] }` — each must exist.
- **200**: `data` = user with `roles`. **422**: change would leave zero `roles.manage` holders. **404**: user missing. Spatie cache forgotten so access updates without re-login (FR-006).

---

## Settings

### `GET /api/v1/settings`
- **Perm**: `permission:settings.manage`.
- **200**: `data` = `{ "gym": { "name", "colors": {primary,secondary,accent}, "logo" }, "reminder_days", "currency", "vat_rate", "receipt_template" }` (missing keys → null/defaults).

### `PUT /api/v1/settings`
- **Perm**: `permission:settings.manage`; **throttle**: `api`.
- **Body** (`UpdateSettingsRequest`, all optional, validated per D8): `reminder_days` int≥0; `vat_rate` 0–100; `currency` ISO size:3; `gym.name` ≤255; `gym.colors.*` hex; `gym.logo` image upload/string; `receipt_template` string.
- **200**: updated settings `data`. **422**: any invalid value (e.g. negative reminder_days, VAT > 100). **403**: lacks perm.
- **Side effects**: writes audit entry (FR-026); downstream consumers (`reminder_days` → P1 reminders, `vat_rate`/`receipt_template` → P2 receipts) read new values immediately.

---

## Audit Log

### `GET /api/v1/audit-logs?subject=&causer=&from=&to=`
- **Perm**: `permission:audit.view`.
- **Query** (query-builder): `filter[subject]` = alias (`member|subscription|sale|payment|payroll|employee|...`), `filter[causer]` = user id, `filter[from]` + `filter[to]` = dates (`from ≤ to`), `sort` default `-created_at`, `page`.
- **200**: `data` = array of `AuditLogResource` `{ id, action, subject: {type, id}, causer: {id, name}|null, causer_type, changes, created_at }`, paginated meta.
- **422**: `from > to`, or unknown subject alias.
- **403**: lacks `audit.view`.

---

## Export

### `GET /api/v1/export/{resource}?format=xlsx|csv|pdf&...filters`
- **resource** ∈ `{members, subscriptions, sales, payments, payroll, reports}`.
- **Perm**: `permission:export.{resource}` (resolved from route param via `SystemPermissions` map); **throttle**: `sensitive`.
- **Query** (`ExportRequest`): `format` ∈ `{xlsx,csv,pdf}` (required), plus the same filters the resource's index accepts (reused `AllowedFilter` set).
- **Small dataset (< threshold)** → **200** streamed file download (correct `Content-Type`/`Content-Disposition`).
- **Large dataset (≥ threshold)** → **202 Accepted**, `data` = `{ "export_id", "status": "processing" }`; `GenerateExportJob` queued; completed file retrieved via **signed temporary URL** (user-scoped, expiring).
- **422**: unknown `resource` or unsupported `format` (`ExportRequest` enum validation).
- **403**: lacks `export.{resource}`.
- **Side effects**: audit entry per request (causer + resource + format, FR-021); job failure logged + on `failed_jobs`.

*(If implemented, a retrieval/status route — e.g. `GET /api/v1/export/download/{export}` behind a signed URL — returns the completed file or 404/410 if expired. Exact retrieval shape finalized in tasks.)*

---

## Cross-cutting contract guarantees (security pass)

- **Every** route above (and every existing P0–P3 non-public route) carries `auth:sanctum` + a `permission:` gate — asserted by `EndpointGatingSweepTest` (SC-001).
- **CORS** (`config/cors.php`) restricts `allowed_origins` to `FRONTEND_URL`.
- **Throttling**: login → `auth`; POS sale create + all export → `sensitive`; other writes → `api`.
- **No sensitive fields** (`password`, `remember_token`, secrets) appear in any response (`$hidden` review).
