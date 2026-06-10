# Test Suite Review (T068)

**Runner:** Pest (SQLite in-memory, sync queue, array cache — per `phpunit.xml`)
**Command:** `php artisan test` (run with PHP 8.4 — `~/.config/herd-lite/bin/php`; the default PATH `php` is 8.2 and fails the platform check)
**Date:** 2026-06-10
**Result:** PASS

```
Tests:    55 passed (181 assertions)
Duration: ~2.0s
```

## Coverage by endpoint / story

| Area | Cases covered |
|------|---------------|
| US1 Health | `GET /api/v1/health` 200 + envelope shape |
| US1 Error contract | Standard 404 JSON error shape |
| US2 Login | 200 (valid), 401 (invalid credentials, enumeration-safe), 422 (validation) |
| US2 Current user | 200 (authenticated), 401 (no token) |
| US2 Logout | 200 + token revocation (revoked token reuse rejected) |
| US3 Protected sample | 200 (with permission), 403 (authenticated, no permission), 401 (unauthenticated) |
| US3 Foundation seeder | roles/permissions created, Admin assignment, idempotency, non-admin exclusion |
| US4 Audit | activity_log row created on tracked action |
| US4 Audit privacy | properties exclude passwords/tokens |
| US5 Settings | store/read/update/missing-key/array-cast |
| US5 Queue probe | dispatchable, runs on sync, implements ShouldQueue |
| US5 Cache / Storage / Broadcast readiness | read/write probes + CheckInfrastructureReadiness reporting |

## Known coverage gap (deferred, non-blocking)
- **QA-1:** No test asserts the `429 too_many_requests` path on login. The `throttle:auth` limiter and renderer exist and were verified manually; an explicit feature test is recommended in Phase 1.
