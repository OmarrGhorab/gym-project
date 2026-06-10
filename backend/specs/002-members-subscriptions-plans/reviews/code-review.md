# Members, Subscriptions & Plans — Final Code Review (T108)

**Reviewer:** laravel-code-reviewer
**Date:** 2026-06-10
**Branch:** `codex/001-backend-foundation`
**Scope:** Entire spec `002-members-subscriptions-plans` backend implementation.
**Authority:** `.specify/memory/constitution.md`, `specs/002-members-subscriptions-plans/tasks.md`

## Verdict: APPROVED WITH MINOR COMMENTS

The implementation is constitution-aligned overall: thin controllers, Form Requests for validation, policies/permission middleware for authorization, Actions for business rules, API Resources for transport shape, queued reminder delivery, and strong Pest coverage across the phase. I did not find a merge-blocking defect in the shipped code. The remaining notes are mainly contract/behavior alignment items.

---

## Findings

### Major

None.

### Minor

### M1 — Dashboard expiring-soon semantics are narrower than the feature name suggests
**Files:** `app/Http/Controllers/Api/V1/DashboardController.php`, `app/Actions/Reminders/FindExpiringSubscriptions.php`

The dashboard endpoint currently reuses reminder eligibility, so subscriptions already reminded today disappear from the “expiring soon” list. That makes the endpoint semantically closer to “expiring soon and not reminded today” than a pure expiring-soon dashboard slice.

**Recommendation:** split the dashboard finder from the reminder finder in a follow-up so the endpoint name and behavior match cleanly.

### M2 — Notification permission constant is seeded but not enforced on the notification routes
**Files:** `app/Support/MembershipPermissions.php`, `database/seeders/MembershipAccessSeeder.php`, `routes/api/notifications.php`

The codebase defines and seeds `notifications.view`, but the routes are only `auth:sanctum` protected and rely on own-user scoping. Safe enough, but it leaves a small mismatch between the permission catalog and real enforcement.

**Recommendation:** either add the permission middleware or intentionally collapse the design to auth-only and remove the unused permission from the membership matrix.

### M3 — API contract had drifted from dues/dashboard behavior
**Files:** `specs/002-members-subscriptions-plans/contracts/api.md`, `app/Http/Controllers/Api/V1/PaymentController.php`, `app/Http/Controllers/Api/V1/DashboardController.php`

This was a documentation issue rather than a code defect, and it has been corrected in Phase 10. I’m keeping it in the review because it was the main end-of-phase mismatch: `status=due` returns outstanding subscription summaries, and dashboard expiring-soon is single-page, collection-backed output.

## Verified-Good

- **Thin transport:** controllers stay orchestration-only and do not accumulate business logic.
- **Action boundaries:** subscription creation/renewal/freeze/stop and payment recording are isolated into testable Actions.
- **Validation/authorization:** Form Requests and policies/middleware are used consistently.
- **Resources/envelope:** API response shaping is consistent across the phase.
- **Test coverage:** focused unit tests cover money math and lifecycle rules; feature tests cover auth/403/404/422 paths across the endpoints.
- **Concurrency-sensitive areas:** freeze and payment logic were built with transactions/locking and regression coverage.

## Summary

This is a solid backend phase. The implementation reads coherently, the tests back the high-risk rules, and the remaining issues are mostly about clarifying behavior rather than repairing broken behavior.
