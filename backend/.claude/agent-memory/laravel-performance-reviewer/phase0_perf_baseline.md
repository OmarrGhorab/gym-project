---
name: phase0-perf-baseline
description: Phase 0 foundation perf baseline — indexes, caching layers, queue setup, and what is intentionally synchronous
metadata:
  type: project
---

Phase 0 foundation perf characteristics (verified at T070, 2026-06-10):

- **Indexes present:** `settings.key` unique; Sanctum `personal_access_tokens` (unique token, indexed expires_at, tokenable morph); Spatie permission tables intact (composite uniques, morph indexes, cascade FKs); `activity_log.log_name` indexed + subject/causer morphs; `users.email` unique (default migration). No missing index in the foundation slice.
- **Spatie permission cache:** `config/permission.php` → `expiration_time` 24h, `store => default`. `permission:` middleware resolves from cache, NOT per-request DB. Seeder calls `forgetCachedPermissions()` before seeding. Do not flag per-request permission re-query — it's cached.
- **Queue:** only heavy work is `FoundationProbeJob` (named `ShouldQueue`, observable in failed_jobs). `CheckInfrastructureReadiness` does config-name checks for queue/broadcast (no inline dispatch). Good.
- **Intentionally synchronous (do NOT recommend queuing):** `RecordFoundationActivity` writes ONE audit row per protected-sample hit — must be durable with the request; single insert is cheap. Only revisit if logged in a loop or with heavy properties.
- **Caching deferred (YAGNI):** `Setting` reads are not on any hot path in Phase 0 (no endpoint reads settings yet). Add a read-through cache + invalidation in `StoreSetting::execute` only when a hot read path exists.
- **No pagination needed:** Phase 0 endpoints (health/login/me/logout/protected-sample) all return single objects or static payloads — no collections.

Verdict was PASS, one Medium ([[userresource-spatie-lazyload]]).
