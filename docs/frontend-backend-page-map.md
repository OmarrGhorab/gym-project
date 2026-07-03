# Frontend to Backend Page Map

This file explains how each important frontend page is wired to the Laravel backend.

## Backend Request Flow

Most dashboard pages follow the same path:

1. A Next.js Server Component page calls a local `data.ts` loader.
2. The loader calls `serverApiFetch()` from `frontend/src/lib/api/server.ts`.
3. `serverApiFetch()` reads the auth token from the HTTP-only session cookie.
4. It calls Laravel at `${API_BASE_URL}/...`, where `API_BASE_URL` points to `/api/v1`.
5. Laravel routes are protected by `auth:sanctum`, `throttle:api`, and per-route permission middleware.
6. Laravel returns the standard envelope: `{ data, meta, message }`.

Mutations follow this path:

1. A client dialog/form submits to a Next.js Server Action in an `actions.ts` file.
2. The action validates/transforms form fields.
3. The action calls the Laravel endpoint through `serverApiFetch()`.
4. The action calls `revalidatePath()` for affected dashboard routes.
5. The client closes the dialog, shows a toast, and refreshes.

File/media routes use Next.js Route Handlers as authenticated proxies. They keep backend tokens off the browser and stream files from Laravel.

## Shared Frontend API Files

| File | Purpose |
| --- | --- |
| `frontend/src/lib/api/server.ts` | Server-side authenticated fetch wrapper for Laravel `/api/v1`. |
| `frontend/src/lib/auth.ts` | Client auth helper that calls Next `/api/auth/*` proxy routes. |
| `frontend/src/lib/session.ts` | Reads the current token/user by calling backend `/auth/me`. |
| `frontend/src/lib/actions/logout.ts` | Logs out through backend `/auth/logout` and clears session cookies. |
| `frontend/src/lib/api/media-proxy.ts` | Shared helper for streaming protected backend images/files through Next route handlers. |
| `frontend/src/app/api/auth/_lib.ts` | Auth proxy utilities: backend URL building, cookie options, response forwarding. |

## Auth Pages

### Login

Frontend:
- `frontend/src/app/(main)/auth/v1/login/page.tsx`
- `frontend/src/app/(main)/auth/v2/login/page.tsx`
- `frontend/src/app/(main)/auth/_components/login-form.tsx`
- `frontend/src/lib/auth.ts`
- `frontend/src/app/api/auth/login/route.ts`

Backend:
- `POST /api/v1/auth/login`
- Controller: `AuthController@login`

Logic:
- Browser submits credentials to Next `/api/auth/login`.
- Next forwards to Laravel `/auth/login`.
- Laravel validates credentials and returns user/token.
- Next stores token/session cookies for dashboard requests.

### Register

Frontend:
- `frontend/src/app/(main)/auth/v1/register/page.tsx`
- `frontend/src/app/(main)/auth/v2/register/page.tsx`
- `frontend/src/app/(main)/auth/_components/register-form.tsx`
- `frontend/src/app/api/auth/register/route.ts`

Backend:
- `POST /api/v1/auth/register`
- Controller: `AuthController@register`

Logic:
- User creates account through the Next auth proxy.
- Laravel creates user and starts the email verification flow.

### Email Verification and Password Reset

Frontend:
- `frontend/src/app/(main)/auth/v2/verify-email/page.tsx`
- `frontend/src/app/(main)/auth/v2/forgot-password/page.tsx`
- `frontend/src/app/(main)/auth/v2/reset-password/page.tsx`
- `frontend/src/app/api/auth/verify-email/route.ts`
- `frontend/src/app/api/auth/resend-verification/route.ts`
- `frontend/src/app/api/auth/forgot-password/route.ts`
- `frontend/src/app/api/auth/verify-otp/route.ts`
- `frontend/src/app/api/auth/reset-password/route.ts`

Backend:
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/reset-password`
- Controller: `AuthController`

Logic:
- Frontend forms call Next proxy routes.
- Next forwards to Laravel.
- Laravel handles OTP/email state and returns success/error messages.

### Google Login

Frontend:
- `frontend/src/app/(main)/auth/_components/social-auth/google-button.tsx`
- `frontend/src/app/api/auth/google/redirect/route.ts`
- `frontend/src/app/api/auth/google/callback/route.ts`

Backend:
- `GET /api/v1/auth/google/redirect`
- `GET /api/v1/auth/google/callback`
- Controller: `AuthController@socialRedirect`, `AuthController@socialCallback`

Logic:
- Frontend starts OAuth through Next.
- Next asks Laravel for redirect/callback handling.
- Callback stores backend token/session cookies.

## Dashboard Shell

### Global Search

Frontend:
- `frontend/src/app/(main)/dashboard/_components/sidebar/search-dialog.tsx`
- `frontend/src/app/api/dashboard/search/route.ts`

Backend:
- `GET /api/v1/search`
- Controller: `SearchController`

Logic:
- Sidebar search calls Next `/api/dashboard/search`.
- Next forwards the query to Laravel with the auth token.
- Laravel returns searchable records across backend domains.

### Locale

Frontend:
- `frontend/src/app/api/locale/route.ts`
- `frontend/src/app/(main)/auth/_components/language-toggle.tsx`
- `frontend/src/app/(main)/dashboard/_components/sidebar/language-selector.tsx`

Backend:
- None.

Logic:
- Stores locale preference in a frontend cookie.
- Does not call Laravel.

## Dashboard Default

Frontend:
- `frontend/src/app/(main)/dashboard/page.tsx`
- `frontend/src/app/(main)/dashboard/default/page.tsx`
- `frontend/src/app/(main)/dashboard/default/_components/data.ts`

Backend:
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/members`
- `GET /api/v1/sales/report`
- `GET /api/v1/dashboard/active-subscriptions`
- `GET /api/v1/dashboard/sales-today`
- `GET /api/v1/dashboard/top-products`
- Controllers: `DashboardController`, `MemberController`, `SaleController`

Logic:
- Loads high-level KPIs, recent members, sales chart data, active subscriptions, today's sales, and top products.
- This page is the main operations snapshot.

## Members

Frontend:
- `frontend/src/app/(main)/dashboard/members/page.tsx`
- `frontend/src/app/(main)/dashboard/members/_components/data.ts`
- `frontend/src/app/(main)/dashboard/members/_components/actions.ts`
- `frontend/src/app/(main)/dashboard/members/_components/member-action-dialogs.tsx`
- `frontend/src/app/(main)/dashboard/members/_components/member-details-dialog.tsx`
- `frontend/src/app/api/media/members/[id]/photo/route.ts`

Backend:
- `GET /api/v1/members`
- `POST /api/v1/members`
- `GET /api/v1/members/{member}`
- `PUT /api/v1/members/{member}`
- `DELETE /api/v1/members/{member}`
- `GET /api/v1/members/{member}/payment-history`
- `GET /api/v1/members/{member}/payments`
- `POST /api/v1/members/{member}/photo`
- `GET /api/v1/members/{member}/photo`
- `GET /api/v1/member-visits`
- Controller: `MemberController`, `MemberVisitController`

Logic:
- Main page lists members with filters, pagination, QR/photo status, subscription summary, and total paid.
- Create/edit/deactivate forms call member mutation endpoints.
- Details modal calls payment-history, direct payments, and member visits.
- Photo upload sends `FormData` to Laravel. Member avatars load through Next `/api/media/members/{id}/photo`, which proxies the protected Laravel stream endpoint.

## Plans

Frontend:
- `frontend/src/app/(main)/dashboard/plans/page.tsx`
- `frontend/src/app/(main)/dashboard/plans/_components/data.ts`
- `frontend/src/app/(main)/dashboard/plans/_components/actions.ts`

Backend:
- `GET /api/v1/plans`
- `POST /api/v1/plans`
- `GET /api/v1/plans/{plan}`
- `PUT /api/v1/plans/{plan}`
- `PATCH /api/v1/plans/{plan}/toggle`
- `DELETE /api/v1/plans/{plan}`
- Controller: `PlanController`

Logic:
- Loads all membership plans.
- Forms create/update plans.
- Toggle changes active/sellable state.

## Attendance

Frontend:
- `frontend/src/app/(main)/dashboard/attendance/page.tsx`
- `frontend/src/app/(main)/dashboard/attendance/_components/data.ts`
- `frontend/src/app/(main)/dashboard/attendance/_components/actions.ts`

Backend:
- `GET /api/v1/attendance`
- `GET /api/v1/attendance/summary`
- `GET /api/v1/attendance/shifts`
- `GET /api/v1/attendance/violations`
- `GET /api/v1/attendance/violation-rules`
- `POST /api/v1/attendance/check-in`
- `POST /api/v1/attendance/check-out`
- `POST /api/v1/attendance`
- `PUT /api/v1/attendance/{attendance}`
- `DELETE /api/v1/attendance/{attendance}`
- `PUT /api/v1/attendance/violations/{attendanceViolation}`
- Controller: `AttendanceController`

Logic:
- Page shows attendance logs, summaries, shift context, and violations.
- Actions handle check-in/check-out/manual attendance and violation review.

## Finance

Frontend:
- `frontend/src/app/(main)/dashboard/finance/page.tsx`
- `frontend/src/app/(main)/dashboard/finance/_components/data.ts`
- `frontend/src/app/(main)/dashboard/finance/_components/actions.ts`
- `frontend/src/app/api/finance/export/route.ts`
- `frontend/src/app/api/finance/export/[id]/status/route.ts`
- `frontend/src/app/api/finance/export/[id]/download/route.ts`

Backend:
- `GET /api/v1/reports/finance-summary`
- `GET /api/v1/reports/financial`
- `GET /api/v1/expenses`
- `POST /api/v1/expenses`
- `PUT /api/v1/expenses/{expense}`
- `DELETE /api/v1/expenses/{expense}`
- `GET /api/v1/export/{resource}`
- `GET /api/v1/export/status/{exportId}`
- `GET /api/v1/export/download/{exportId}`
- Controllers: `ReportController`, `ExpenseController`, `ExportController`

Logic:
- Page combines finance summary report, financial chart report, expense records, and export actions.
- Expense dialogs create/update/delete expense records.
- Export links go through Next proxy route handlers so signed/protected downloads work from the browser.

## Ecommerce / POS

Frontend:
- `frontend/src/app/(main)/dashboard/ecommerce/page.tsx`
- `frontend/src/app/(main)/dashboard/ecommerce/_components/data.ts`
- `frontend/src/app/(main)/dashboard/ecommerce/_components/actions.ts`
- `frontend/src/app/api/sales/[id]/receipt/route.ts`
- `frontend/src/app/api/media/products/[id]/image/route.ts`

Backend:
- `GET /api/v1/reports/pos-summary`
- `GET /api/v1/products`
- `GET /api/v1/products/{product}/image`
- `GET /api/v1/sales`
- `GET /api/v1/sales/daily`
- `POST /api/v1/sales`
- `POST /api/v1/sales/{sale}/void`
- `GET /api/v1/sales/{sale}/receipt`
- Controllers: `ReportController`, `ProductController`, `SaleController`

Logic:
- POS dashboard loads products, recent sales, daily sales, and POS KPIs.
- Checkout creates a sale with cart items/payment details.
- Void action cancels a sale.
- Receipt and product images are protected backend files streamed through Next proxy routes.

## Logistics / Inventory

Frontend:
- `frontend/src/app/(main)/dashboard/logistics/page.tsx`
- `frontend/src/app/(main)/dashboard/logistics/_components/data.ts`
- `frontend/src/app/(main)/dashboard/logistics/_components/actions.ts`

Backend:
- `GET /api/v1/reports/inventory-logistics`
- `GET /api/v1/products`
- `POST /api/v1/products`
- `PUT /api/v1/products/{product}`
- `PATCH /api/v1/products/{product}/toggle`
- `DELETE /api/v1/products/{product}`
- `POST /api/v1/products/{product}/stock`
- `GET /api/v1/purchase-orders`
- `POST /api/v1/purchase-orders`
- `POST /api/v1/purchase-orders/{purchaseOrder}/receive`
- Controllers: `ReportController`, `ProductController`, `PurchaseOrderController`

Logic:
- Page shows stock/product/inventory logistics report.
- Product dialogs create/update/toggle/delete products.
- Stock adjustment modifies inventory.
- Purchase order actions create and receive stock.

## Payroll

Frontend:
- `frontend/src/app/(main)/dashboard/payroll/page.tsx`
- `frontend/src/app/(main)/dashboard/payroll/_components/data.ts`
- `frontend/src/app/(main)/dashboard/payroll/_components/actions.ts`
- `frontend/src/app/api/payroll/[id]/payslip/route.ts`

Backend:
- `GET /api/v1/payroll`
- `POST /api/v1/payroll/generate`
- `PUT /api/v1/payroll/{payroll}`
- `POST /api/v1/payroll/{payroll}/pay`
- `GET /api/v1/payroll/{payroll}/payslip`
- Controller: `PayrollController`

Logic:
- Page lists payroll rows.
- Generate action creates payroll for a selected month.
- Pay action marks payroll paid.
- Update action edits payroll fields.
- Payslip download is proxied through Next.

## Academy / Staff

Frontend:
- `frontend/src/app/(main)/dashboard/academy/page.tsx`
- `frontend/src/app/(main)/dashboard/academy/_components/data.ts`
- `frontend/src/app/(main)/dashboard/academy/_components/actions.ts`

Backend:
- `GET /api/v1/reports/staff-academy`
- `GET /api/v1/reports/employees`
- `GET /api/v1/employees`
- `POST /api/v1/employees`
- `PUT /api/v1/employees/{employee}`
- `DELETE /api/v1/employees/{employee}`
- `GET /api/v1/employees/{employee}/commissions`
- `GET /api/v1/employees/{employee}/performance`
- `POST /api/v1/commissions/backfill`
- Controllers: `ReportController`, `EmployeeController`, `CommissionController`

Logic:
- Staff dashboard combines staff academy report, employee records, performance, and commission data.
- Actions create/update/delete employees and trigger commission backfill.

## Analytics

Frontend:
- `frontend/src/app/(main)/dashboard/analytics/page.tsx`
- `frontend/src/app/(main)/dashboard/analytics/_components/data.ts`

Backend:
- `GET /api/v1/reports/live-attendance`
- Controller: `ReportController@liveAttendance`

Logic:
- Page visualizes live attendance as analytics-style traffic data.
- This is a backend report rendered as dashboard analytics cards/charts.

## CRM

Frontend:
- `frontend/src/app/(main)/dashboard/crm/page.tsx`
- `frontend/src/app/(main)/dashboard/crm/_components/data.ts`
- `frontend/src/app/(main)/dashboard/crm/_components/actions.ts`

Backend:
- `GET /api/v1/members`
- `GET /api/v1/plans`
- `GET /api/v1/subscriptions`
- `POST /api/v1/subscriptions`
- `PUT /api/v1/subscriptions/{subscription}`
- Related payment/member summary routes as used by the data loader
- Controllers: `MemberController`, `PlanController`, `SubscriptionController`

Logic:
- CRM is membership/subscription oriented.
- It loads members, plans, and subscription records to show pipeline/activity style views.
- Actions create/update subscription-style CRM records.

## Kanban

Frontend:
- `frontend/src/app/(main)/dashboard/kanban/page.tsx`
- `frontend/src/app/(main)/dashboard/kanban/_components/data.ts`
- `frontend/src/app/(main)/dashboard/kanban/_components/actions.ts`

Backend:
- `GET /api/v1/gym-tasks`
- `POST /api/v1/gym-tasks`
- `GET /api/v1/gym-tasks/{gymTask}`
- `PUT /api/v1/gym-tasks/{gymTask}`
- `DELETE /api/v1/gym-tasks/{gymTask}`
- `POST /api/v1/gym-tasks/{gymTask}/comments`
- Controller: `GymTaskController`

Logic:
- Kanban columns are built from gym task records.
- Drag/update actions patch task status/order.
- Details/comments use show and comment endpoints.

## Productivity

Frontend:
- `frontend/src/app/(main)/dashboard/productivity/page.tsx`
- `frontend/src/app/(main)/dashboard/productivity/_components/data.ts`
- `frontend/src/app/(main)/dashboard/productivity/_components/actions.ts`

Backend:
- `GET /api/v1/reports/operations-summary`
- `GET /api/v1/reports/operations-calendar-events`
- `POST /api/v1/reports/operations-calendar-events`
- `PUT /api/v1/reports/operations-calendar-events/{event}`
- `DELETE /api/v1/reports/operations-calendar-events/{event}`
- Controller: `ReportController`

Logic:
- Page uses operations summary for task/project-like productivity cards.
- Calendar actions manage operations events.

## Calendar

Frontend:
- `frontend/src/app/(main)/dashboard/calendar/page.tsx`
- `frontend/src/app/(main)/dashboard/calendar/_components/data.ts`
- `frontend/src/app/(main)/dashboard/calendar/_components/actions.ts`

Backend:
- `GET /api/v1/reports/operations-calendar-events`
- `POST /api/v1/reports/operations-calendar-events`
- `PUT /api/v1/reports/operations-calendar-events/{event}`
- `DELETE /api/v1/reports/operations-calendar-events/{event}`
- Controller: `ReportController`

Logic:
- Calendar page renders backend operations calendar events.
- Create/update/delete actions mutate the same report event resource.

## Tasks

Frontend:
- `frontend/src/app/(main)/dashboard/tasks/page.tsx`
- `frontend/src/app/(main)/dashboard/tasks/_components/data.ts`

Backend:
- `GET /api/v1/gym-tasks`
- Controller: `GymTaskController@index`

Logic:
- Read-only task table view over gym tasks.
- Full task mutations are handled in the Kanban page.

## Roles

Frontend:
- `frontend/src/app/(main)/dashboard/roles/page.tsx`
- `frontend/src/app/(main)/dashboard/roles/_components/data-live.ts`
- `frontend/src/app/(main)/dashboard/roles/_components/actions.ts`

Backend:
- `GET /api/v1/roles`
- `POST /api/v1/roles`
- `GET /api/v1/roles/{role}`
- `PUT /api/v1/roles/{role}`
- `DELETE /api/v1/roles/{role}`
- `GET /api/v1/permissions`
- Controller: `RoleController`, `PermissionController`

Logic:
- Loads roles and permissions.
- Actions create/update/delete roles and attach permissions.

## Users

Frontend:
- `frontend/src/app/(main)/dashboard/users/page.tsx`
- `frontend/src/app/(main)/dashboard/users/_components/data.ts`
- `frontend/src/app/(main)/dashboard/users/_components/actions.ts`

Backend:
- `GET /api/v1/users`
- `GET /api/v1/roles`
- `POST /api/v1/users/{user}/roles`
- Controller: `UserController`, `RoleController`, `UserRoleController`

Logic:
- Loads users and available roles.
- Action assigns roles to a user.

## Settings

Frontend:
- `frontend/src/app/(main)/dashboard/settings/page.tsx`
- `frontend/src/app/(main)/dashboard/settings/_components/data.ts`
- `frontend/src/app/(main)/dashboard/settings/_components/actions.ts`

Backend:
- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `GET /api/v1/attendance/shifts/manage`
- `POST /api/v1/attendance/shifts`
- `PUT /api/v1/attendance/shifts/{employeeShift}`
- `DELETE /api/v1/attendance/shifts/{employeeShift}`
- `GET /api/v1/attendance/violation-rules`
- `PUT /api/v1/attendance/violation-rules/{attendanceViolationRule}`
- Controllers: `SettingController`, `AttendanceController`

Logic:
- Page loads app settings plus attendance shift/rule settings.
- Forms update general settings, shift definitions, and violation rules.

## Infrastructure / System

Frontend:
- `frontend/src/app/(main)/dashboard/infrastructure/page.tsx`
- `frontend/src/app/(main)/dashboard/infrastructure/_components/data.ts`

Backend:
- `GET /api/v1/reports/system-health`
- `GET /api/v1/health`
- `GET /api/v1/foundation/protected-sample`
- Controller: `ReportController@systemHealth`, `HealthController`, `ProtectedSampleController`

Logic:
- Shows operational health.
- Probes public health and protected sample endpoint to verify auth/permission wiring.

## Audit

Frontend:
- `frontend/src/app/(main)/dashboard/audit/page.tsx`
- `frontend/src/app/(main)/dashboard/audit/_components/data.ts`

Backend:
- `GET /api/v1/audit-logs`
- Controller: `AuditLogController@index`

Logic:
- Lists backend audit logs with search/filter/pagination.
- Permission required: `audit.view`.

## Mail / Notifications

Frontend:
- `frontend/src/app/(main)/dashboard/mail/page.tsx`
- `frontend/src/app/(main)/dashboard/mail/_components/data.ts`
- `frontend/src/app/(main)/dashboard/mail/_components/actions.ts`
- `frontend/src/app/(main)/mail/page.tsx`

Backend:
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{notification}/read`
- Controller: `NotificationController`

Logic:
- Dashboard mail page is backed by notification records.
- Mark-read action patches the notification.
- The standalone `/mail` route mostly renders the mail UI around the same notification concept.

## Invoice / Document Center

Frontend:
- `frontend/src/app/(main)/dashboard/invoice/page.tsx`
- `frontend/src/app/(main)/dashboard/invoice/_components/document-center-data.ts`
- `frontend/src/app/(main)/dashboard/invoice/_components/document-center.tsx`

Backend:
- `GET /api/v1/payroll`
- `GET /api/v1/payroll/{payroll}/payslip`
- `GET /api/v1/sales`
- `GET /api/v1/sales/{sale}/receipt`
- `GET /api/v1/export/{resource}`
- Controllers: `PayrollController`, `SaleController`, `ExportController`

Logic:
- Document center lists payroll and sales documents.
- Download buttons use Next proxy routes for payslips, receipts, and finance exports.
- The invoice editor itself is mostly frontend UI/state, not a persisted backend invoice resource.

## Mostly Static or Demo Pages

These pages currently render static/demo UI or legacy dashboard variants rather than primary Laravel-backed workflows:

| Frontend page | Backend status |
| --- | --- |
| `frontend/src/app/(main)/dashboard/coming-soon/page.tsx` | No backend calls. |
| `frontend/src/app/(main)/dashboard/(legacy)/default-v1/page.tsx` | Static legacy/demo data. |
| `frontend/src/app/(main)/dashboard/(legacy)/analytics-v1/page.tsx` | Static legacy/demo data. |
| `frontend/src/app/(main)/dashboard/(legacy)/crm-v1/page.tsx` | Static legacy/demo data. |
| `frontend/src/app/(main)/dashboard/(legacy)/finance-v1/page.tsx` | Static legacy/demo data. |
| `frontend/src/app/(main)/unauthorized/page.tsx` | Frontend-only authorization fallback. |
| `frontend/src/app/not-found.tsx` | Frontend-only 404 page. |
| `frontend/src/app/error.tsx` | Frontend-only root error boundary. |
| `frontend/src/app/(main)/dashboard/error.tsx` | Frontend-only dashboard error boundary. |

