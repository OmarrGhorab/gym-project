---
name: security-conventions
description: Verified-good Phase 0 security patterns and the deferred hardening items to re-check when later phases add endpoints/uploads
metadata:
  type: project
---

Phase 0 (T069 review, 2026-06-10) was PASS. Patterns confirmed good in this codebase:

- Models use explicit `$fillable` allowlists (`User`, `Setting`); `$guarded=[]` is forbidden by the Constitution and absent. `User::$hidden` = password, remember_token; password cast `hashed`.
- Login is account-enumeration safe: same `InvalidCredentialsException` for unknown-email and wrong-password, `Hash::check` (timing-safe). Test asserts 401 not 404.
- Logout deletes `currentAccessToken()` only (per-token revocation, not all devices).
- Audit log credential blocklist exists in two places: `config/activitylog.php` `default_except_attributes` (password, remember_token, token, api_key, secret) AND `app/Actions/Foundation/RecordFoundationActivity::stripSensitiveKeys`.
- All queries are Eloquent/bindings — no raw SQL anywhere. Secrets are env-only in `config/services.php` and `config/filesystems.php`.

**Deferred hardening items to RE-CHECK in P1/P2+ (raised as Medium, not blocking in P0):**
- **`config/filesystems.php` `local` disk has `serve => true`** rooted at `storage/app/private`. Before any phase stores sensitive uploads/exports/reports there (or on `remote`), confirm the `storage:` serve route is auth+policy gated, or set `serve => false` and stream via an authorized controller.
- **`StoreSetting` accepts `mixed $value` with no validation** — fine while code-only. Any future settings write endpoint MUST front it with a Form Request (key allowlist, typed/size-capped values).
- **Login throttle keyed on IP only** — recommend email+IP composite key to bound per-account brute force and avoid NAT collisions.
- **`auth/me` had no throttle** — recommend applying `throttle:api` to the whole `auth:sanctum` group.

See [[auth-token-setup]].
