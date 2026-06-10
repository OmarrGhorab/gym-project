---
name: auth-token-setup
description: How authentication, tokens, guards, rate limiting, and the API error envelope are wired in this Gym Platform backend
metadata:
  type: project
---

Authentication & authorization wiring as of Phase 0 (verify before relying — files may have moved).

- **Sanctum** is the API auth (`config/sanctum.php` guard = `['web']`). Routes use `auth:sanctum`. Login issues a one-time plaintext token via `createToken('staff-token')->plainTextToken`.
- **Spatie laravel-permission** for roles/permissions. Roles/permissions are seeded with `guard_name => 'web'` (`database/seeders/FoundationAccessSeeder.php`) — this MUST match the Sanctum guard `web` or permission checks silently fail. Guards align as of Phase 0.
- Middleware aliases `role`, `permission`, `role_or_permission` registered in `bootstrap/app.php` `withMiddleware`.
- **Permission constants** live in `app/Support/FoundationPermissions.php` (e.g. `foundation.access-sample`). Authorization is enforced via route `->middleware('permission:...')`, NOT in controllers (Constitution forbids hand-rolled checks).
- **Rate limiters** are defined in `app/Providers/AppServiceProvider.php` via `RateLimiter::for()` (there is no RouteServiceProvider in Laravel 12 here): `auth` = 10/min by IP, `api` = 60/min by user-id-or-IP. Applied as `throttle:auth` / `throttle:api` in `routes/api.php`.
- **API error envelope** is centralized in `bootstrap/app.php` `withExceptions`: stable shape `{ error: { code, message, details } }`. Catch-all only exposes `$e->getMessage()` when `app()->hasDebugModeEnabled()`. `InvalidCredentialsException` (extends `AuthenticationException`) renders 401 `invalid_credentials`, distinct from `unauthenticated`.
- **Success envelope**: `{ data, meta, message }` via `app/Http/Responses/ApiResponse.php` and the `WrapsApiResponse` trait (in `Resources/Concerns/`).

See [[security-conventions]].
