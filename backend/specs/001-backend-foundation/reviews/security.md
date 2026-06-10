# Phase 0 Foundation — Security Review (T069)

**Reviewer:** laravel-security-reviewer
**Date:** 2026-06-10
**Scope:** Phase 0 foundation code (bootstrap, routes, models, controllers, requests, resources, actions, jobs, seeders, config, migrations).
**Reference:** `.specify/memory/constitution.md` Principle V (Security by Default), OWASP Top 10.

## Verdict: PASS

No Critical or High findings. The foundation implements the Constitution's security-by-default gates correctly: explicit `$fillable` allowlists, `$hidden` on sensitive fields, every non-public endpoint authenticated and (where applicable) permission-gated via middleware, rate limiting on auth and write endpoints, bindings-only queries, env-only secrets, debug-gated error messages, account-enumeration-safe login, real token revocation on logout, and an audit-log blocklist for credentials. Remaining items are Medium/Low/Info hardening notes, none blocking.

---

## Critical

None.

## High

None.

## Medium

### M1 — `login` and `me` responses are not rate-limited as tightly as login; `me`/`logout` reuse the per-user `api` limiter keyed off `optional($request->user())->id`
**File:** `routes/api.php:37-41`, `app/Providers/AppServiceProvider.php:43-47`
**Finding:** `auth/me` (GET) has **no throttle middleware at all** — it sits inside the `auth:sanctum` group but no `throttle:` is applied. Only `logout` carries `throttle:api`. An attacker with a valid token (or testing many stolen tokens) can hammer `me` without limit. While `me` is authenticated, an unthrottled authenticated endpoint still aids token-validity probing and resource abuse.
**Fix:** Apply a throttle to the whole authenticated group rather than per-route:
```php
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
});
```
This also removes the duplicated per-route `throttle:api` on logout.

### M2 — Login throttle is keyed on IP only, not email+IP
**File:** `app/Providers/AppServiceProvider.php:39-41`
**Finding:** `RateLimiter::for('auth')` limits 10/min **by IP only**. Attackers behind a single IP can spray 10 distinct accounts/min; conversely, many users behind one NAT/proxy share the 10/min budget (DoS of legitimate logins). Laravel's own `LoginRequest` convention throttles on `email|ip`.
**Fix:** Key on a combination so per-account brute force and shared-IP collisions are both bounded:
```php
RateLimiter::for('auth', fn (Request $r) =>
    Limit::perMinute(10)->by(Str::lower((string) $r->input('email')).'|'.$r->ip())
);
```
Consider a second, looser per-IP limit to cap total spray. 10/min/account is still generous for a staff login — 5/min is defensible.

### M3 — `local` disk has `serve => true`
**File:** `config/filesystems.php:33-39`
**Finding:** The `local` (private) disk roots at `storage/app/private` and sets `serve => true`, which registers a `storage:` route to stream those files. Phase 0 stores nothing user-facing there, but later phases will store uploads/exports/reports on `local`/`remote`. Serving a "private" disk without an explicit authorization gate on the serve route risks unauthenticated access to private artifacts once files land there.
**Fix:** Before any phase writes sensitive files to this disk, confirm the serve route is protected (Sanctum + policy) or set `serve => false` and stream files through an authorized controller action. Track as a P1/P2 prerequisite. Not exploitable in Phase 0 (no files stored), hence Medium.

## Low

### L1 — `optional()` helper is deprecated-style; use null-safe operator
**File:** `app/Providers/AppServiceProvider.php:45`
**Finding:** `optional($request->user())->id ?: $request->ip()` works but `?:` treats id `0` as falsy (not a real risk for auto-increment PKs) and `optional()` is legacy. Minor.
**Fix:** `($request->user()?->id) ?? $request->ip()`.

### L2 — `me` returns full role+permission lists on every call
**File:** `app/Http/Resources/UserResource.php:34-35`
**Finding:** `getAllPermissions()` exposes the complete permission set to the client. This is intended for the SPA but is information disclosure if a token is stolen. Acceptable for a staff dashboard; flagging for awareness. Ensure later resources do not leak internal-only permissions.
**Fix:** None required now; keep permission names non-sensitive (they are: `foundation.access-sample`).

### L3 — Setting `value` JSON column is unbounded and unvalidated at the model layer
**File:** `app/Models/Setting.php`, `app/Actions/Settings/StoreSetting.php`
**Finding:** `StoreSetting::execute` accepts `mixed $value` and writes JSON with no size/shape validation. No HTTP endpoint exposes this in Phase 0 (callable only from code/seeders), so untrusted input cannot currently reach it. When a settings write endpoint is added, it MUST front this with a Form Request (allow-listed keys, typed values, size cap) to prevent storage abuse / JSON injection of unexpected structures.
**Fix:** Add a Form Request + key allowlist when the write endpoint is introduced. No action needed in Phase 0.

## Info / Verified-Good

- **Mass assignment:** `User` (`app/Models/User.php:24-28`) and `Setting` (`app/Models/Setting.php:22-25`) both declare explicit `$fillable`. No `$guarded = []`, no `create($request->all())`. Login flow passes only `validated('email')`/`validated('password')` as typed args — no model mass assignment from request. Compliant with Constitution V.
- **Hidden sensitive fields:** `User::$hidden` includes `password`, `remember_token` (`User.php:37-40`); `password` cast to `hashed`. `UserResource` (`UserResource.php:30-36`) never references password/tokens. Test `LoginTest.php:40-54` asserts the token-issuance response excludes both. The Sanctum plaintext token is returned exactly once at login and never persisted in recoverable form.
- **Authentication on protected routes:** `me`, `logout`, and `foundation/protected-sample` all sit under `auth:sanctum` (`routes/api.php:37-52`). `health` and `login` are intentionally public.
- **Authorization (no hand-rolled checks):** `foundation/protected-sample` is gated by `permission:foundation.access-sample` middleware (`routes/api.php:51`), enforced by Spatie, not by in-controller `if` checks. `ProtectedSampleController` contains no permission logic. Compliant with Constitution II/V.
- **Guard consistency:** Sanctum guard is `web` (`config/sanctum.php:40`); Spatie roles/permissions seeded with `guard_name => 'web'` (`FoundationAccessSeeder.php:31,39`). Guards align, so permission checks resolve correctly against the Sanctum-authenticated user. Verified.
- **Token revocation on logout:** `LogoutStaffUser` (`LogoutStaffUser.php:19-25`) deletes `currentAccessToken()`, genuinely invalidating only the presenting token (other devices unaffected, per contract). Correct for the token guard.
- **Account enumeration:** `LoginStaffUser.php:33-39` returns the identical `InvalidCredentialsException` for unknown email and wrong password; uses `Hash::check` (timing-safe bcrypt compare). Test `LoginTest.php:75-80` confirms 401 (not 404) for unknown email. Compliant with FR-007.
- **Error response hygiene:** All API exceptions render the stable `{ error: { code, message, details } }` envelope (`bootstrap/app.php:35-155`). The catch-all (`bootstrap/app.php:141-155`) only exposes `$e->getMessage()` when `hasDebugModeEnabled()`; otherwise a generic message. No stack traces/SQL leaked in production. Validation details are field errors only.
- **Injection:** All persistence uses Eloquent query builder with bindings — `User::where('email', $email)` (`LoginStaffUser.php:33`), `Setting::updateOrCreate`/`where` (`StoreSetting.php:28,44`). No `DB::raw`, `whereRaw`, or string-concatenated SQL anywhere in scope.
- **Audit log excludes secrets:** `config/activitylog.php:54-60` global `default_except_attributes` blocks `password`, `remember_token`, `token`, `api_key`, `secret`. `RecordFoundationActivity` (`RecordFoundationActivity.php:52-57`) additionally strips the same keys from caller-supplied properties (defence in depth). Compliant with FR-014 / Constitution V.
- **Secrets via env only:** `config/services.php` and `config/filesystems.php` read every credential from `env()` (`AWS_*`, `REMOTE_DISK_*`, `REVERB_*`, `POSTMARK_*`, etc.). No literal secrets committed.
- **Queue job safety:** `FoundationProbeJob` (`FoundationProbeJob.php`) only logs at debug, no side effects, no untrusted input, observable via `failed_jobs`.
- **Infra readiness probes:** `CheckInfrastructureReadiness` catches all `Throwable`, logs only `$e->getMessage()` (no secrets), never throws. Probe writes go to fixed internal keys/paths, not user-controlled. No path traversal (`storage` probe path is a constant).
- **Migrations:** `users` and `settings` migrations are reversible (`down()` present); `settings.key` is uniquely indexed (`2026_06_10_140000_create_settings_table.php:17`). No destructive ops on populated tables.

## Summary

Phase 0 satisfies every Constitution Principle V security gate. The login/logout/permission flows follow the layered model (Form Request validates, middleware authorizes, Actions hold logic, Resources shape output) with no security logic in controllers. The three Medium items are forward-looking hardening — the most actionable is **M1 (add `throttle:api` to the authenticated route group so `me` is rate-limited)** and **M2 (key the login throttle on email+IP, not IP alone)**. Both are quick fixes and neither blocks Phase 0. M3 is a prerequisite to track before any phase writes sensitive files to the `local`/`remote` disks. Approved for merge.
