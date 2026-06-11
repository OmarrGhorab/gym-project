# Architecture Review — 005 Permissions Matrix, Audit, Export & Branding

**Date:** 2026-06-11
**Reviewer:** laravel-architecture-reviewer
**Feature:** 005-permissions-audit-branding
**Deliverable:** T002

## Verdict: APPROVED

The architecture of Phase 4 is sound and aligns fully with the backend design principles set out in the Constitution. It leverages existing infrastructure from earlier phases while wrapping them in a consolidated API surface.

---

## Constitution Compliance

- **Laravel-First**: Built entirely using standard Laravel constructs and pre-installed Spatie/Maatwebsite/Barryvdh packages. No new external dependencies are added.
- **Thin Transport**: All role/permission modifications, settings updates, and export generation details are handled inside dedicated `Actions/*` and `Jobs/*` classes, keeping controllers thin.
- **Test-First with Pest**: Comprehensive unit and feature tests are mapped for each new controller, policy, request, action, and job.
- **Versioned Contract**: New routes are registered inside `/api/v1` routes using standard controllers and the uniform `{ data, meta, message }` JSON envelope.
- **Security by Default**: Every endpoint is gated behind both `auth:sanctum` and a granular permission gate (e.g. `roles.manage`, `settings.manage`, `audit.view`, `export.{resource}`). Rate limiting is enforced on login, POS, and export operations.
- **Performance**: Audit logs are queryable with eager loading of `subject` and `causer` to avoid N+1 queries. Large exports are offloaded to queue jobs and fetched via temporary signed URLs.
- **YAGNI**: No speculative abstractions, repository classes, or complex wrapper models. Spatie Eloquent models are used directly.

---

## Risks & Mitigations

### R1 — Admin Lock-out Risk (High)
Dynamic CRUD operations on roles could accidentally modify or delete the last remaining role containing `roles.manage`, or remove the last user holding this role, orphaning administrative access.
- *Mitigation*: Action classes (`UpdateRole`, `DeleteRole`, `SyncUserRoles`) will execute count checks to refuse operations that would result in zero active users possessing the `roles.manage` permission.

### R2 — Large Export Memory Exhaustion (Medium)
Exporting lists with millions of rows synchronously could exhaust memory limits or timeout requests.
- *Mitigation*: Use a configurable row threshold (`export.sync_threshold`). Exports exceeding the threshold are executed asynchronously in a queued job using memory-efficient cursor-based chunking (`FromQuery`) and saved to private storage.

---

## Refactoring Suggestions
- Clean up Spatie cache explicitly whenever roles or permissions are updated or synced to ensure changes are applied immediately without requiring a user to log out/in.
