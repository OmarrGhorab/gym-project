---
name: project-gym-platform
description: Gym Platform project context — backend phase structure, current state, and key integration contracts
metadata:
  type: project
---

REST API backend for a Gym Platform (members, subscriptions, POS, payroll, reporting). Laravel 12 / PHP 8.4+, MySQL, Redis. API-first.

**Why:** Understanding the phase structure and integration contracts prevents forward dependencies and broken contracts across phases.

**How to apply:** Confirm the current phase before starting work. Honor integration contracts listed below — they span phases and cannot be broken.

## Phase structure

- Phase 0: Foundation (auth, roles/permissions, audit log, settings, health check, queue/cache/storage readiness)
- Phase 1: Members + subscriptions
- Phase 2: POS + sales
- Phase 3: Payroll + commissions + reports
- Phase 4: Final permission matrix, branding, exports

## Integration contracts (must not be broken across phases)

1. `sold_by_user_id` on subscriptions (P1) and sales (P2) references `users` — no forward dependency on `employees`. P3 links commissions via `employees.user_id` + a backfill command.
2. Polymorphic `payments` defined once in P1 (`payable_type`/`payable_id`, status paid/partial/due), reused in P2, read as single revenue source in P3. Do not fork payment logic.

## Current state (as of 2026-06-10, branch codex/001-backend-foundation)

Phase 0 Track A (T007–T051) is now COMPLETE. Track B (US5 T052–T064) was completed by a parallel agent.

**Full suite: 55 tests, 181 assertions, all green.**

### Track A files created

- `bootstrap/app.php` — API routing (`routes/api.php` registered), Spatie middleware aliases (role/permission/role_or_permission), JSON exception handlers for: InvalidCredentialsException (401 invalid_credentials), AuthenticationException (401 unauthenticated), AuthorizationException (403 forbidden), SpatieUnauthorizedException (403 forbidden), ModelNotFoundException (404), NotFoundHttpException (404), ValidationException (422), TooManyRequestsHttpException (429), catch-all Throwable (500)
- `routes/api.php` — `/api/v1` prefix group: GET health (public), POST auth/login (throttle:auth), GET auth/me (auth:sanctum), POST auth/logout (auth:sanctum + throttle:api), GET foundation/protected-sample (auth:sanctum + permission:foundation.access-sample)
- `app/Http/Responses/ApiResponse.php` — static success() and error() envelope factories
- `app/Http/Controllers/Api/V1/ApiController.php` — abstract base with success()/error() helpers and AuthorizesRequests
- `app/Http/Controllers/Api/V1/HealthController.php`
- `app/Http/Controllers/Api/V1/AuthController.php` — login/me/logout; thin; uses LoginStaffUser/LogoutStaffUser actions
- `app/Http/Controllers/Api/V1/Foundation/ProtectedSampleController.php` — calls RecordFoundationActivity then returns success
- `app/Http/Resources/Concerns/WrapsApiResponse.php` — trait adding withMessage()/withMeta()/with() to any JsonResource
- `app/Http/Resources/UserResource.php` — id/name/email/roles/permissions (getRoleNames/getAllPermissions)
- `app/Http/Requests/Auth/LoginRequest.php` — authorize=true, rules: email required+string+email, password required+string
- `app/Models/User.php` — HasApiTokens + HasRoles added; $fillable/hidden/casts preserved
- `app/Actions/Auth/LoginStaffUser.php` — email+password → User+token; throws InvalidCredentialsException on fail
- `app/Actions/Auth/LogoutStaffUser.php` — currentAccessToken()->delete()
- `app/Actions/Foundation/RecordFoundationActivity.php` — activity('foundation')->causedBy(user)->event(event)->log(description); strips sensitive keys
- `app/Exceptions/InvalidCredentialsException.php` — extends AuthenticationException; renders as 401 invalid_credentials
- `app/Support/FoundationPermissions.php` — ALL_ROLES, ALL_PERMISSIONS constants
- `app/Providers/AppServiceProvider.php` — RateLimiter::for('auth', 10/min by IP), RateLimiter::for('api', 60/min by user/IP)
- `database/seeders/FoundationAccessSeeder.php` — Admin/Manager/Cashier/Captain/Accountant roles; foundation.access-sample permission assigned to Admin
- `database/seeders/DatabaseSeeder.php` — calls FoundationAccessSeeder only (no test user)
- `config/activitylog.php` — default_except_attributes: ['password','remember_token','token','api_key','secret']
- `specs/001-backend-foundation/reviews/architecture.md`

### Critical caveats discovered in Track A

1. **Sanctum auth guard caches user between test requests.** When testing token revocation in a single test, call `$this->app['auth']->forgetGuards()` between requests that need a fresh Sanctum token lookup.
2. **Spatie PermissionMiddleware throws `Spatie\Permission\Exceptions\UnauthorizedException`** (extends `Symfony\Component\HttpKernel\Exception\HttpException`), NOT `Illuminate\Auth\Access\AuthorizationException`. Must register a separate render handler for it in bootstrap/app.php.
3. **Throttle named rates** are defined in AppServiceProvider via `RateLimiter::for()`, not in a RouteServiceProvider (there is none in this project — Laravel 12 uses AppServiceProvider).

### Previously noted (Track B / US5)

- Settings migration: `database/migrations/2026_06_10_140000_create_settings_table.php`
- `config/filesystems.php`: 'remote' disk added (env-driven, S3-compatible)
- `config/services.php`: 'realtime' key added (env-driven, Reverb/Pusher capable)

## Key environment facts

- Real project path: `/d/Gym-project/backend` (Windows maps `D:\Gym-project\backend` to this)
- PHP 8.4 binary: `/c/Users/Raven_dev/.config/herd-lite/bin/php.exe`
- Composer: `/c/Users/Raven_dev/.config/herd-lite/bin/composer.phar`
- Run with: `/c/Users/Raven_dev/.config/herd-lite/bin/php.exe /c/Users/Raven_dev/.config/herd-lite/bin/composer.phar ...`
- Tests use SQLite in-memory (DB_CONNECTION=sqlite, DB_DATABASE=:memory:) per phpunit.xml
