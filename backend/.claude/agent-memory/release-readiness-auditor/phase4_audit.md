---
name: phase4-audit
description: Phase 4 (005-permissions-audit-branding) release-readiness audit — FAILED on red suite (lock-out guard contract mismatch)
metadata:
  type: project
---

Phase 4 audit (release-readiness gate, 2026-06-11). Branch `005-permissions-audit-branding`. **VERDICT: FAIL.**

**Decisive blocker — suite is RED: 3 failed / 419 passed (1622 assertions), herd-lite 8.4.** `release-readiness.md` claims "GREEN, 54 tests" — FALSE. Always run the suite live; the review docs lied this phase (all 6 review docs say PASSED).

**Root cause of the 3 failures (all in `tests/Feature/Api/V1/Roles/RoleLockoutGuardTest.php`):** the global ValidationException renderer at `bootstrap/app.php:129-139` hardcodes `error.message = "The given data was invalid."` and puts per-field messages in `error.details` (`$e->errors()`). The 3 lock-out guards (`DeleteRole`, `UpdateRole`, `SyncUserRoles`) throw `ValidationException::withMessages(['role'|'permissions' => ['specific lock-out text']])`. Tests assert `error.message` equals the specific lock-out string — impossible given the handler. Mismatch can be fixed either side, but the practical fix: tests should assert on `error.details.role[0]` / `error.details.permissions[0]`, OR the lock-out guards should throw a dedicated exception that the handler renders with the specific message. This is the same `error.details` key sensitivity flagged in [[feedback-recurring-gaps]] (Phase 1 note about RecordPayment detail keys). FR-008 (anti-admin-lockout) is the security control left unverified.

**Second blocker — committed debug scaffolding:** `tests/Feature/Api/V1/Export/_ProbeTest.php` — 3 `PROBE` tests that `expect(true)->toBeTrue()` and `fwrite(STDERR, ...)`. Dead/debug code in the suite; Constitution Code-Review gate bans "debug output / commented-out/dead code left in." Must be deleted before merge.

**Everything else PASSED on direct code re-verification:**
- Export auth via route gates `can:export-resource,resource` + `can:download-export,exportId` (AppServiceProvider Gate::define). Download route has `signed` middleware; status route relies on the ownership gate (no signed — documented intentionally). User-scoped via `metadata['user_id'] === $user->id`.
- `BuildExport::getExportCount` uses `getCountForPagination()` (no collection materialization); FromCollection ReportExport returns 0 → always sync (acceptable, aggregated). Queued path dispatches `GenerateExportJob` on `exports` queue, timeout 600, tries 1, logs failure + lands on failed_jobs.
- `activity_log` index migration: composite `(causer_id, created_at)` + `(created_at)`, existence-guarded up() AND down() — reversible and idempotent. Good pattern.
- `User` model: explicit `$fillable` (name/email/password), `$hidden` (password, remember_token), password hashed cast. No `$guarded=[]` anywhere in app/Models.
- Rate limiters: auth(10/ip), sensitive(10/user|ip), api(60), export(5) all defined. export routes use `throttle:export`. Lock-out guards now eager-load `roles.permissions` (N+1 fix from prior review confirmed in tree).
- AuditLogController eager-loads causer+subject, paginates, FormRequest (`IndexAuditLogRequest`) validates from/to (`after_or_equal`) + subject alias + authorizes via `viewAny` policy. Reads `validated()`.
- Envelope/contract consistent; `GET /export/{resource}` returns 202 queued / streamed sync per contract.

**Note on contract drift (non-blocking):** ExportController returns HTTP 500 `export_failed` on sync export exception — contract doesn't list 500 for that path, but it's a defensible internal-error mapping.

**Tasks.md all `[x]` including gate tasks T069-T075 — but the checked record tasks are not trustworthy this phase** (unlike Phase 3 where the issue was *unchecked* records). Inverse failure mode: records claim GREEN/PASSED while suite is RED. Lesson reinforced: never accept `reviews/*.md` verdicts; run the suite.
