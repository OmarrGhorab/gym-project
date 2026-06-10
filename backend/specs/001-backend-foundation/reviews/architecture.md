# Architecture Review: Backend Phase 0 Foundation

**Date**: 2026-06-10
**Reviewer**: laravel-feature-engineer (pre-implementation)
**Branch**: `001-backend-foundation`
**Status**: APPROVED — design conforms to Constitution and Phase 0 spec

---

## Constitution Compliance

### Layering

The planned implementation follows the mandatory layering exactly:

```
Route → Controller → FormRequest (validate) + Policy/Permission Middleware (authorize)
      → Action/Service (business logic)
      → Eloquent (persistence)
      → API Resource (response)
```

All controllers will be thin coordinators. Business logic is isolated in invokable Action classes under `app/Actions/`. Actions take typed, already-validated inputs and never reference the HTTP request object directly.

### Thin Transport

- `HealthController` — returns a static enveloped response directly (no action needed; health check is trivial, consistent with YAGNI).
- `AuthController` — delegates to `LoginStaffUser` and `LogoutStaffUser` actions; returns `UserResource`.
- `ProtectedSampleController` — delegates to `RecordFoundationActivity` action; returns minimal enveloped response.
- Validation lives in `LoginRequest` (Form Request). No inline validation.
- Authorization lives in Spatie permission middleware (`permission:foundation.access-sample`) on the protected sample route. No hand-rolled checks in controllers.

### Response Contract

Single envelope for all success responses:
```json
{ "data": {}, "meta": {}, "message": "..." }
```

Single stable error shape for all failure responses:
```json
{ "error": { "code": "...", "message": "...", "details": {} } }
```

`ApiResponse` helper provides `success()` and `error()` factory methods. `WrapsApiResponse` concern is mixed into API Resources for consistent envelope behavior. Exception handlers in `bootstrap/app.php` map all standard Laravel exceptions to the stable error shape.

### Security

- `User` model: explicit `$fillable`; `password` and `remember_token` in `$hidden`; no `$guarded = []`.
- Login route is throttled (rate limited via named throttle middleware).
- Every non-public endpoint is behind `auth:sanctum` middleware.
- Protected sample endpoint additionally requires `permission:foundation.access-sample`.
- Audit log properties exclude `password`, `token`, and other sensitive fields.

### Performance

- No N+1 risk: `UserResource` uses `getRoleNames()` and `getAllPermissions()` — both are loaded via Spatie's built-in eager load on the `HasRoles` trait when called.
- No unbounded collections in Phase 0 endpoints.
- No synchronous heavy work; audit logging is synchronous but is a single database write (acceptable for Phase 0; later phases queue it if needed).

### Simplicity (YAGNI)

- No repository pattern.
- No speculative interfaces.
- `HealthController` returns directly without an Action class — the action would be a single line returning a fixed string, which is not non-trivial business logic.
- `WrapsApiResponse` concern is the minimal shared behavior needed for consistent envelope output.

---

## Phase 2 Design Conformance

### Files To Be Created

| File | Constitution Requirement |
|------|-------------------------|
| `specs/001-backend-foundation/reviews/architecture.md` | T007: pre-implementation review |
| `routes/api.php` | Versioned `/api/v1` group |
| `app/Http/Responses/ApiResponse.php` | Stable success/error envelope |
| `app/Http/Controllers/Api/V1/ApiController.php` | Thin base controller |
| `app/Http/Resources/Concerns/WrapsApiResponse.php` | Resource envelope behavior |
| `app/Support/FoundationPermissions.php` | Role/permission constants |
| `database/seeders/FoundationAccessSeeder.php` | Foundation roles + permissions seeded |

### bootstrap/app.php Changes

- Register `routes/api.php` with `/api` prefix.
- Register JSON exception renderers for: `AuthenticationException` → 401, `AuthorizationException` → 403, `ModelNotFoundException` → 404, `NotFoundHttpException` → 404, `ValidationException` → 422, `ThrottleRequestsException` → 429, all others → 500 (no internals leaked in production).

### User Model Changes

- Add `HasApiTokens` trait (Sanctum).
- Add `HasRoles` trait (Spatie Permission).
- Preserve existing `$fillable`, `$hidden`, and `casts()`.

---

## Verdict

**APPROVED.** The Phase 2 design is fully compliant with the Constitution. No deviations or exceptions required. Implementation may proceed.
