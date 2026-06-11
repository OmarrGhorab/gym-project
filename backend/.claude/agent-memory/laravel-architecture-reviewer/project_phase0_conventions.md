---
name: project-phase0-conventions
description: Phase 0 foundation patterns (envelope, permissions, throttle, exception renderers) that every later phase reuses and must not rebuild
metadata:
  type: project
---

Phase 0 is delivered. Verify designs reuse these rather than rebuilding (Constitution I):

- **Response envelope**: `app/Http/Responses/ApiResponse.php` (`success`/`error` static helpers) and the `App\Http\Resources\Concerns\WrapsApiResponse` trait (adds `meta`+`message` via `with()`, fluent `withMessage()`/`withMeta()`). Success = `{data,meta,message}`, error = `{error:{code,message,details}}`. Resources `use WrapsApiResponse`.
- **Exception → envelope** is centralized in `bootstrap/app.php` `withExceptions`. It already renders the stable codes: `invalid_credentials`/`unauthenticated` (401), `forbidden` (403, both Laravel AuthorizationException AND Spatie UnauthorizedException), `not_found` (404), `validation_failed` (422), `too_many_requests` (429), `server_error` (500, message hidden unless debug). New phases get these for free — do not re-handle in controllers.
- **Permissions**: constants in `app/Support/FoundationPermissions.php` (roles Admin/Manager/Cashier/Captain/Accountant; perm `foundation.access-sample`). Later phases add their OWN constants class (e.g. `MembershipPermissions`), never edit `FoundationPermissions`. Seeder pattern = `database/seeders/FoundationAccessSeeder.php`: idempotent `firstOrCreate`, `forgetCachedPermissions()` first, guard_name `web`.
- **Middleware**: `permission:`/`role:`/`role_or_permission:` aliased in `bootstrap/app.php`. Routes gate with `->middleware('permission:foo.bar')`.
- **Throttle**: named limiters in `app/Providers/AppServiceProvider.php` (NOT a RouteServiceProvider — none exists in Laravel 12 here): `auth` = 10/min by IP, `api` = 60/min by user-or-IP. Apply `throttle:api` to write/sensitive routes.
- **Settings**: `app/Models/Setting.php` is key/value with `value` JSON-cast. `settings.reminder_days` is read by later phases.

**Known carry-in defect**: `app/Http/Resources/UserResource.php` calls `getRoleNames()`/`getAllPermissions()` (Spatie lazy-loads per instance) — its "no N+1 risk" docblock is FALSE; embedding it in a collection is a real N+1 (PERF-1). See [[feedback-recurring-findings]].

**Why:** These are the load-bearing seams every endpoint depends on; a design that rebuilds them violates Constitution I/IV.
**How to apply:** When reviewing a new phase, confirm new Resources use `WrapsApiResponse`, new permissions mirror the constants+seeder pattern, error handling relies on the central renderers, and writes are throttled.
