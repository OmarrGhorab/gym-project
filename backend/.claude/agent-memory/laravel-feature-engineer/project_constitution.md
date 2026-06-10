---
name: project-constitution
description: Location and key enforced rules from the Gym Platform project Constitution
metadata:
  type: project
---

The project Constitution lives at `.specify/memory/constitution.md` and is ratified at version 1.0.0 (2026-06-10). It governs all AI agents and human contributors.

**Why:** Treat as supreme source of truth — it overrules CLAUDE.md, habits, and convenience on any conflict.

**How to apply:** Read before designing any feature. Its NON-NEGOTIABLE sections block merge if violated.

Key enforced rules most likely to affect feature design:

- Laravel-first: exhaust native features before adding packages or abstractions. Justify any addition in PR.
- Thin controllers: Route → FormRequest (validate) + Policy (authorize) → Action/Service → Eloquent → API Resource. No business logic in controllers.
- Test-first with Pest: write failing test, implement, go green. PHPUnit-style classes forbidden for new tests.
- All routes under `/api/v1`. Uniform `{ data, meta, message }` envelope for success; stable error shape for failures.
- Security: explicit `$fillable` allowlist on all models (`$guarded = []` forbidden); `$hidden` for sensitive fields; every non-public endpoint auth + policy-gated; no raw concatenated SQL.
- N+1 is a defect: eager-load all relations used in Resources.
- Paginate all unbounded collections.
- Queue heavy/slow work (mail, exports, third-party calls, aggregation).
- YAGNI: no repository pattern over Eloquent, no single-implementation interfaces.
