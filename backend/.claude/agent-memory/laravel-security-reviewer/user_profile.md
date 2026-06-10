---
name: user-profile
description: Repo owner and how security reviews are expected to be conducted on this project
metadata:
  type: user
---

Owner: Omar Ghorab. Building a Gym Platform REST API (Laravel 12 / PHP 8.4) delivered in sequential phases (`phases/`, `specs/00X-*`).

Review expectations:
- The `.specify/memory/constitution.md` is the authoritative source of truth; Principle V (Security by Default) is NON-NEGOTIABLE and a violation blocks merge.
- Reviews are written to `specs/<feature>/reviews/security.md` with a PASS/FAIL verdict, findings grouped by severity (Critical/High/Medium/Low/Info) each with file:line and a concrete fix, plus a short summary.
- Do NOT modify application code during a review — document only, and report Critical/High back to the requester.
- Reviewer should be conservative/uncompromising; treat absent controls as findings.
