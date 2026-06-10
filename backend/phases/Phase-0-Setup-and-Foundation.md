# Phase 0 — Setup & Foundation

---

## 1. Objective
Establish the technical foundation that every later phase builds on: project skeletons, authentication (Laravel Sanctum), the roles & permissions framework, the audit-log mechanism, the base RTL Arabic layout/design system, and the core (non-business) database tables. No business features here — but nothing in Phases 1–4 can be built without this layer.

## 2. Scope
### In scope
- Laravel API skeleton + Next.js dashboard skeleton.
- Authentication (Laravel Sanctum) end-to-end (login/logout/me).
- Roles & permissions framework (`spatie/laravel-permission`) + activity log (`spatie/laravel-activitylog`).
- Uniform API conventions (response envelope, validation errors, versioning `/api/v1`).
- Base UI shell (sidebar/topbar), RTL Arabic, ATP theme tokens (placeholders).
- Queue, scheduler, cache (Redis), realtime (Reverb/Pusher) and storage (local or R2) — **drivers/config wired in the app**, ready for features to use.

### Out of scope (handled later)
- Any business module (Members → Phase 1, POS → Phase 2, HR/Reports → Phase 3, final permission matrix/branding/export → Phase 4).

## 3. Prerequisites (depends on)
- None. This is the root phase.

## 4. Deliverables
1. Laravel API skeleton with health check + auth (runs locally).
2. Next.js dashboard that logs in against the API and shows an RTL app shell.
3. Working roles/permissions assignment + a sample gated route.
4. Activity log recording at least one event.
5. Test suite scaffolded and passing on both repos.

## 5. Detailed Tasks

### 5.1 Backend
- Initialize Laravel 11+ (PHP 8.3+); set up `.env` (DB, Redis, mail, broadcast, filesystem).
- Install & configure packages: `laravel/sanctum`, `spatie/laravel-permission`, `spatie/laravel-activitylog`, `spatie/laravel-query-builder`, `maatwebsite/excel`, `barryvdh/laravel-dompdf`.
- Build base API layer:
  - `/api/v1` route group + `routes/api.php` structure.
  - Global JSON response envelope `{ data, meta, message }` (base `JsonResource` + helper/macro).
  - Exception handler → uniform `422` validation errors, `401/403` auth errors.
  - Base `FormRequest` and base `ApiController`.
- Auth: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (Sanctum SPA cookie if same root domain, else Bearer tokens).
- CORS config (origin locked down later in Phase 4).
- Seed initial roles (Admin/Manager/Cashier/Captain/Accountant) — permissions are filled per module in their phases.
- Redis connection for queue + cache; verify a queued job dispatches/processes.
- Realtime: configure Reverb (or Pusher) broadcasting connection.
- Storage: configure local disk + R2 (S3) disk; image-upload helper/service.
- Testing: Pest/PHPUnit setup, base factories, base test command.

### 5.2 Frontend
- Initialize Next.js 14/15 (App Router, TypeScript).
- Tailwind CSS + shadcn/ui; theme tokens for ATP branding (colors/logo placeholders, editable later from Settings).
- `next-intl` + `dir="rtl"`, Arabic as default locale.
- HTTP client (fetch/axios) with interceptors (auth header/cookie, 401 handling, error normalization).
- Auth flow: `/login` page, session/token persistence, `ProtectedRoute`/middleware, `useAuth` hook.
- App shell: sidebar + topbar + content layout (responsive).
- TanStack Query provider + base query/mutation patterns.
- `usePermission()` hook (reads current-user permissions, gates UI).
- Base building blocks: DataTable wrapper, Form wrapper (React Hook Form + Zod), Toast, ConfirmDialog, `<Can>` component.

## 6. Database (tables introduced / modified)
Core (non-business) tables only:

| Table | Purpose |
|---|---|
| `users` | System login accounts |
| `password_reset_tokens`, `sessions` | Auth support (sessions if SPA cookie) |
| `personal_access_tokens` | Sanctum tokens |
| `roles`, `permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions` | Spatie permissions |
| `activity_log` | Audit trail |
| `settings` | Key/value (json) — branding, reminder lead-time, VAT, currency |
| `jobs`, `failed_jobs` | Queue |
| `cache` | If using DB cache fallback |

## 7. API Endpoints
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/v1/auth/login` | Returns user + token / sets cookie |
| POST | `/api/v1/auth/logout` | Revoke token/session |
| GET | `/api/v1/auth/me` | Current user + roles + permissions |
| GET | `/api/v1/health` | Health check |

## 8. Frontend Pages & Components
- `/login`.
- App shell (sidebar/topbar) + empty `/dashboard` placeholder.
- Shared components: DataTable, Form wrapper, Toast, ConfirmDialog, permission-gated `<Can>`.

## 9. Integration Contracts (exposed for later phases)
- **Auth contract:** `auth:sanctum` guard + `GET /auth/me` returning `permissions[]`. All later endpoints sit behind this.
- **Permission contract:** Spatie installed; each later phase registers its own permissions (e.g. `members.*` in Phase 1). Final matrix consolidated in Phase 4.
- **Response/validation contract:** `{ data, meta, message }` envelope + `422` error shape — all phases follow it.
- **Audit contract:** `activity_log` ready; later models add the `LogsActivity` trait.
- **Settings contract:** `settings` table available for reminder lead-time (Phase 1), VAT/receipt (Phase 2), branding (Phase 4).
- **App-infra contract:** queue, scheduler, realtime channel, and storage disk are configured in the app and callable by later phases.

## 10. Acceptance Criteria (Definition of Done)
- [ ] Login/logout works from the dashboard against the API.
- [ ] `GET /auth/me` returns roles + permissions.
- [ ] Assigning a role to a user gates a sample protected route (API + UI).
- [ ] An action is recorded in `activity_log`.
- [ ] Dashboard renders RTL Arabic with ATP theme tokens.
- [ ] A test job dispatches and is processed via the Redis queue.
- [ ] `settings` can store and read a branding value.
- [ ] Test suite passes on both repos.

## 11. Demo Checklist
Log in → land on the empty dashboard shell (RTL + ATP theme) → show a gated route hidden for a low-privilege role → show one entry in the activity log.

## 12. Notes
- Decide early: **same root domain** (Sanctum SPA cookie) vs **separate domains** (Bearer tokens) — affects CORS + auth wiring.
- Lock the response envelope and error shape now; changing it later forces frontend rework across all phases.
