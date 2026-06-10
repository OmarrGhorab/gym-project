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

Phase 0 is in progress. Phase 1: Setup (T001-T006) completed in this session.

- All packages installed: sanctum v4.3.2, spatie/laravel-permission v7.4.2, spatie/laravel-activitylog v5.0.0, spatie/laravel-query-builder v7.3.0, maatwebsite/excel v3.1.69, barryvdh/laravel-dompdf v3.1.2, pestphp/pest v3.8.6.
- Migrations published: personal_access_tokens, permission_tables, activity_log_table.
- Configs published: config/sanctum.php, config/permission.php, config/activitylog.php.
- tests/Pest.php configured with RefreshDatabase for Feature tests.
- Example tests removed (Feature/ExampleTest.php and Unit/ExampleTest.php).

## Key environment facts

- Real project path: `/d/Gym-project/backend` (Windows maps `D:\Gym-project\backend` to this)
- PHP 8.4 binary: `/c/Users/Raven_dev/.config/herd-lite/bin/php.exe`
- Composer: `/c/Users/Raven_dev/.config/herd-lite/bin/composer.phar`
- Run with: `/c/Users/Raven_dev/.config/herd-lite/bin/php.exe /c/Users/Raven_dev/.config/herd-lite/bin/composer.phar ...`
- Tests use SQLite in-memory (DB_CONNECTION=sqlite, DB_DATABASE=:memory:) per phpunit.xml
