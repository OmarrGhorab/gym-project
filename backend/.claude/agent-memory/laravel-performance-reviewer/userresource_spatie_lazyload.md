---
name: userresource-spatie-lazyload
description: UserResource renders Spatie roles/permissions that lazy-load on access — eager-load before rendering, will become 1+N in list endpoints
metadata:
  type: project
---

`app/Http/Resources/UserResource.php` renders `getRoleNames()` and `getAllPermissions()`. Spatie's `HasRoles` trait LAZY-loads `roles`/`permissions` on access (not eager — the class docblock claiming otherwise is wrong). Each render on a non-eager-loaded user = ~2-3 extra queries.

**Why:** Bounded today (single user per login/me request, permissions served from Spatie's 24h permission cache), but becomes a true 1+N (1 + 2N) once any phase renders UserResource over a collection (e.g. staff listings).

**How to apply:** When reviewing any endpoint that renders UserResource, verify the user(s) were loaded `with(['roles','permissions'])` / `loadMissing(...)`. Flag list endpoints rendering it without eager-load as a 1+N defect. Recommend `Model::preventLazyLoading()` in non-production once the first collection endpoint lands (deferred in Phase 0 as YAGNI). Related: [[phase0-perf-baseline]].
