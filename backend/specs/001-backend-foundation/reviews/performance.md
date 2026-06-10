# Performance Review — Backend Phase 0 Foundation (T070)

**Reviewer:** laravel-performance-reviewer
**Date:** 2026-06-10
**Scope:** Recently implemented Phase 0 slice (routes, models, controllers, resources, actions, jobs, seeder, migrations).
**Verdict:** PASS (with one Medium recommendation worth applying before Phase 1 builds on UserResource).

---

## Performance Risks

### 1. UserResource renders `roles`/`permissions` without eager-loading them — Medium
**Files:**
- `app/Http/Resources/UserResource.php:34-35`
- `app/Actions/Auth/LoginStaffUser.php:33` (`User::where('email', $email)->first()`)
- `app/Http/Controllers/Api/V1/AuthController.php:53` (`$request->user()` on `/auth/me`)

`UserResource::toArray()` calls `$this->getRoleNames()` and `$this->getAllPermissions()`. On a `User` instance whose `roles`/`permissions` relations are not already loaded, Spatie's `HasRoles` trait lazy-loads them on access:
- `getRoleNames()` → loads `roles` (1 query)
- `getAllPermissions()` → loads direct `permissions` (1 query) + permissions-via-roles (resolved from the loaded `roles`, served from Spatie's permission cache)

So each render of `UserResource` on a non-eager-loaded user issues roughly **2-3 extra DB queries**. This fires on every `POST /api/v1/auth/login` and `GET /api/v1/auth/me`.

This is **not** an N+1-in-a-loop (it renders a single user per request), so impact is bounded and low in absolute terms. But the Constitution §VI states "Relationships rendered by Resources MUST be eager-loaded." The class docblock claims roles/permissions "are eager-loaded by Spatie's HasRoles trait … no N+1 risk" — that comment is inaccurate: the trait *lazy*-loads on access; nothing eager-loads here. Flagging now because Phase 1+ will render `UserResource` in collection/list contexts (e.g. staff listings), where the same pattern becomes a true 1+N defect.

### 2. `optional()` helper in the `api` rate limiter — Low (style, negligible perf)
**File:** `app/Providers/AppServiceProvider.php:45`
`optional($request->user())->id ?: $request->ip()` works and resolves the already-authenticated user (no extra query — Sanctum has resolved it by the time the limiter runs). No performance concern; `$request->user()?->id` is the modern idiom. Cosmetic only.

---

## Optimization Opportunities

### Fix #1 — Eager-load roles/permissions before rendering UserResource

**Login action** (`LoginStaffUser::handle`):
```php
$user = User::where('email', $email)
    ->with(['roles', 'permissions'])   // eager-load what UserResource renders
    ->first();
```

**`/auth/me`** — `$request->user()` is resolved by Sanctum without the relations. Load them before rendering:
```php
public function me(Request $request): JsonResponse
{
    $user = $request->user()->loadMissing(['roles', 'permissions']);

    return (new UserResource($user))
        ->withMessage('Current user')
        ->response()
        ->setStatusCode(200);
}
```

Also correct the `UserResource` docblock: roles/permissions are lazy-loaded by the trait unless the caller eager-loads them; the resource assumes (and Phase 1 must guarantee) they are loaded. Consider documenting "callers MUST eager-load `roles` and `permissions`" on the resource so list endpoints in later phases don't regress into 1+N.

**Optional hardening (defer to Phase 1, do not add speculatively now):** enabling `Model::preventLazyLoading()` in non-production (`AppServiceProvider::boot`) would surface exactly this class of issue automatically. Reasonable for a platform that will grow many list endpoints, but YAGNI-borderline for the Phase 0 slice — recommend adding it when the first collection endpoint lands.

---

## Expected Impact

- **Fix #1:** reduces `/auth/login` and `/auth/me` from ~3-4 queries to ~1-2 (one user fetch + batched relation load). Per-request DB round-trips drop ~50%. Absolute latency saving is small today (single user, sub-ms relation loads, permissions served from Spatie's 24h cache) but prevents a guaranteed 1+N when `UserResource` is rendered over a collection in Phase 1+ (there it would scale to 1 + 2N queries).
- **How to measure:** wrap a login request in `DB::enableQueryLog()` / `DB::getQueryLog()`, or use Telescope/Clockwork to confirm the role/permission queries collapse from per-access lazy loads into the eager-load batch.

---

## What Was Verified (clean items)

- **Indexes / schema:**
  - `settings.key` has a `unique()` index (`create_settings_table.php:17`) — matches `StoreSetting::updateOrCreate(['key' => …])` and `read()`'s `where('key', …)`. Correct.
  - Spatie permission tables intact and unmodified from the package stub: composite uniques on `(name, guard_name)`, morph indexes on `model_has_roles`/`model_has_permissions`, FKs with `cascadeOnDelete`, primary keys on pivots (`create_permission_tables.php`). No missing index.
  - Sanctum `personal_access_tokens`: unique `token`, indexed `expires_at`, `morphs('tokenable')` (composite index). Auth lookups hit the unique token index. Correct.
  - `activity_log`: `log_name` indexed, `nullableMorphs` for subject/causer (indexed). Adequate for current write-only audit usage. NOTE: `up()` has no `down()` — irreversible migration; acceptable per Constitution only if documented (flagged to schema reviewer, not a perf issue). Audit reads are not implemented in Phase 0, so no missing read index to call out yet.
- **Login lookup** `User::where('email', …)` relies on the `users.email` unique index from the default Laravel users migration — indexed, single-row lookup. Correct.
- **No unbounded collections / missing pagination:** Health, login, me, logout, and protected-sample all return a single object or a static payload. Nothing returns a list. Pagination N/A for this slice — verified, not a gap.
- **Queues:** the only heavy/observable work, the queue probe, is a proper named `ShouldQueue` job (`FoundationProbeJob`) — not run inline. `CheckInfrastructureReadiness` deliberately does a config-name check for queue/broadcast rather than dispatching inline (good — no blocking probe in the request path).
- **Audit logging** (`RecordFoundationActivity`) writes one row synchronously per protected-sample hit. A single insert is cheap and the audit must be durable/transactional with the request, so keeping it synchronous is correct here — do NOT queue it (queuing would risk losing audit records and is unwarranted for one insert). Re-evaluate only if a future endpoint logs in a loop or attaches heavy properties.
- **Caching:** Spatie permission cache is configured (`config/permission.php`: `expiration_time` 24h, `store => default`). The `permission:` middleware therefore resolves permissions from cache, not a per-request DB query — the seeder correctly calls `forgetCachedPermissions()` before seeding. No re-query-per-request concern. `Setting` reads are not on any hot path in Phase 0 (no endpoint reads settings yet), so a read-through cache would be speculative now — defer until a hot read path exists, with intentional invalidation in `StoreSetting::execute`.

---

## Summary

The Phase 0 foundation is performance-clean for its size. Indexes cover every `where`/lookup column in the slice, no unbounded collections exist, the only heavy work is correctly queued, and Spatie's permission cache is in place so authorization does not re-query per request. The one substantive finding is **Medium**: `UserResource` renders `roles`/`permissions` that are lazy-loaded on access, costing ~2-3 extra queries per login/me call and — more importantly — setting a pattern that becomes a true 1+N once Phase 1 renders users in collections. Apply the eager-load fix and correct the misleading docblock before list endpoints are built. No Critical or High findings.
