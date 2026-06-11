---
name: project-constitution
description: Location and force of the Gym Platform Constitution and its NON-NEGOTIABLE principles used in every architecture review
metadata:
  type: project
---

The authoritative governance is `.specify/memory/constitution.md` (v1.0.0, ratified 2026-06-10), supplemented by `CLAUDE.md`. On any conflict the Constitution wins; `CLAUDE.md` elaborates but never overrides.

**Why:** Reviews must reject NON-NEGOTIABLE violations outright, so the rules must be cited from the real source, not from habit.

**How to apply:** Check these 7 principles every review: (I) Laravel-first — exhaust native before any package/abstraction, justify additions in PR; (II) Thin transport — controllers resolve FormRequest → authorize via Policy → call Action (typed args, never the Request) → return API Resource; (III) Test-first Pest (no PHPUnit classes for new tests); (IV) versioned `/api/v1` + single envelope; (V) security by default — explicit `$fillable`, `$hidden`, auth+Policy on every non-public route, no raw SQL, rate-limit writes/auth; (VI) performance — N+1 is a defect, index every where/join/order/FK column, paginate, queue heavy work; (VII) YAGNI — no repository pattern, no single-impl interfaces, duplication beats wrong abstraction.

Build plan is phased (`phases/`, mirrored in `specs/00X-*`). Phase 0 = foundation (done). Each phase ships independently. Mandatory workflow runs `laravel-architecture-reviewer` BEFORE any code is written (this agent's gate).
