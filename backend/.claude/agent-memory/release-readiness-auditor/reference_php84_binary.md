---
name: reference-php84-binary
description: Correct PHP binary for running the test suite — herd-lite 8.4, not the default PATH php (8.2)
metadata:
  type: reference
---

To run the Pest suite / artisan commands for this project, use the PHP 8.4 herd-lite binary:

`/c/Users/Raven_dev/.config/herd-lite/bin/php artisan test`

**Why:** the default `php` on PATH is 8.2 and fails Laravel 12's `platform_check` (require `^8.4`), so `composer test` / `php artisan test` error out before running. Pint must also be invoked through the 8.4 binary: `/c/Users/Raven_dev/.config/herd-lite/bin/php vendor/bin/pint --test`.

**How to apply:** any time you need to verify tests/formatting live during an audit, prefix with the herd-lite 8.4 path. Verified working 2026-06-10: 55 passed / 181 assertions, pint passed.
