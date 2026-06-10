# Phase 4 — Permissions Matrix, Audit, Export, Branding & QA

---

## 1. Objective
Harden and finalize. Consolidate the **complete permission matrix** across all modules, surface the **audit log**, enable **data export everywhere**, finalize the **ATP branding** in the UI, and complete **responsive/RTL QA**. This phase wraps and integrates everything built in Phases 0–3.

## 2. Scope
### In scope
- Final permission matrix + role presets + custom-role support.
- Audit-log API + viewer across all modules.
- Generic export (Excel / CSV / PDF) for members, subscriptions, sales, payments, payroll, reports.
- Settings/branding (name, colors, logo, reminder days, currency/VAT, receipt template).
- Final security pass (app-level) + performance hardening.
- Responsive/RTL QA across all pages + bug-fix sweep.

### Out of scope
- New business features (system is feature-complete after Phase 3).

## 3. Prerequisites
- **All of Phases 0–3** — every module's data and endpoints must exist to be exported, audited, and permission-gated.

## 4. Deliverables
1. Every action permission-gated; role presets + custom roles working (API + UI).
2. Audit-log viewer showing who/what/when across all modules.
3. Export working for all listed resources in all formats, respecting permissions.
4. ATP identity applied in the UI (name/colors/logo).
5. System verified responsive on PC + mobile (RTL).

## 5. Detailed Tasks

### 5.1 Backend
- **Permission matrix:** finalize permissions for every endpoint/action across all modules; define final role presets (**Admin / Manager / Cashier / Captain / Accountant**); support creating custom roles.
- **Audit-log API:** `GET /audit-logs` with filters (subject, causer, date); confirm `LogsActivity` on **all** business models.
- **Export service:** generic exporter for members, subscriptions, sales, payments, payroll, and reports → **Excel/CSV** (maatwebsite/excel) and **PDF** (dompdf); permission-respecting; large exports run as **queued jobs** with a download link.
- **Settings/branding:** `GET/PUT /settings` — name, colors, logo, `reminder_days`, currency, VAT, receipt template; consumed by Phases 1–3 hooks.
- **Security pass (app-level):** rate limiting on sensitive endpoints (login, POS, exports); CORS origin locked to the dashboard (`config/cors.php`); mass-assignment/validation review; soft-delete review.
- **Performance pass:** final index review and slow-query check (JOINs, composite indexes, keyset pagination, Redis-cached dashboards).
- **Tests:** final coverage pass; smoke tests for export and permissions.

### 5.2 Frontend
- `/settings`:
  - **Roles & permissions editor** (matrix UI).
  - **Branding** (theme tokens, logo upload, colors).
  - **System settings** (currency, VAT, reminder days, receipt template).
- **Export buttons** wired across all lists and reports.
- `/audit-logs` — viewer with filters.
- **Responsive/RTL QA** across all pages (PC + mobile); accessibility + empty/error/loading-state polish.
- Apply final **ATP identity** (colors/logo) pulled from settings.
- Final bug-fix sweep.

## 6. Database (tables introduced / modified)
- **No new business tables.** Uses `settings` and `activity_log` (from Phase 0). Finalize indexes added across earlier phases.

## 7. API Endpoints
| Method | Endpoint |
|---|---|
| GET / POST / PUT / DELETE | `/roles` |
| GET | `/permissions` |
| POST | `/users/{id}/roles` |
| GET / PUT | `/settings` |
| GET | `/audit-logs?subject=&causer=&from=&to=` |
| GET | `/export/{resource}?format=xlsx\|csv\|pdf&...filters` |

## 8. Frontend Pages & Components
`/settings` (roles & permissions matrix, branding, system settings), `/audit-logs` (filtered viewer), export buttons across all modules, final responsive/RTL polish.

## 9. Integration Contracts (consumed from earlier phases)
This phase **consumes everything**:
- **Permissions** registered per module (P1 `members.*`, P2 `products/sales.*`, P3 `employees/payroll/reports.*`) → consolidated into the final matrix + role presets here.
- **Audit** — every model that adopted `LogsActivity` (P1–P3) is surfaced through the audit-log viewer.
- **Export** — every list/report from P1–P3 gains export.
- **Settings hooks** seeded in P1 (`reminder_days`) and P2 (VAT/receipt) are finalized in the Settings UI.

## 10. Acceptance Criteria (Definition of Done)
- [ ] Every action is permission-gated; role presets work; a custom role can be created and applied (UI adapts).
- [ ] Audit log shows who/what/when across all modules.
- [ ] Export works for all listed resources in all formats, respecting permissions.
- [ ] ATP branding applied in the UI (name/colors/logo).
- [ ] Verified responsive on PC + mobile (RTL).
- [ ] Final test/coverage pass green.

## 11. Demo Checklist
Full walkthrough across every module with ATP branding → export a financial report (PDF + Excel) → open the audit log and filter by user → change a role's permissions and watch the dashboard UI adapt.

## 12. Notes
- Don't defer the **permission matrix**; gating must cover **every** endpoint or it's a security gap.
- Export of large datasets should be **queued** (background job + download link) to avoid timeouts.
- Confirm **VAT/currency** and receipt format with the client before locking the template.
