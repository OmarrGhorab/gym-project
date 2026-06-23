# Gym Project — Backend Master Review

**Date:** 2026-06-21  
**Sources:** Phase gap analysis · Security audit · Architecture audit · API contract audit · Test coverage audit  
**Backend:** Laravel 12 / PHP 8.4 — `gym-project/backend`

---

## Overall Verdict

The backend is **production-quality in structure** — layering, transactions, concurrency guards, and bcmath money handling are all correct. Every phase is implemented. The gaps cluster into four areas: **3 security issues that must be fixed before go-live**, **7 architecture violations in specific controllers**, **5 API contract breaks**, and **targeted test gaps** in high-risk scenarios.

---

## Summary Table


| Area          | Critical | High   | Medium  | Low      |
| ------------- | -------- | ------ | ------- | -------- |
| Security      | 0        | 3      | 5       | 6        |
| Architecture  | —        | 7      | 9       | 4        |
| API Contract  | —        | 5      | 7       | 4        |
| Phase Gaps    | —        | 1 bug  | 4 infra | 3 design |
| Test Coverage | —        | 5 gaps | 8 gaps  | —        |


---

## PART 1 — SECURITY

### 🔴 HIGH — Fix Before Production

---

#### S-H1 · Password Reset Does Not Revoke Existing Sessions

- **File:** `app/Actions/Auth/ResetUserPassword.php:29`
- **Risk:** An attacker who stole a Sanctum token keeps full API access even after the victim resets their password. The compromise is never contained.
- **Code:**
  ```php
  $user->forceFill(['password' => Hash::make($password)])->save();
  event(new PasswordReset($user));
  // Missing: $user->tokens()->delete();
  ```
- **Fix:**
  ```php
  $user->forceFill(['password' => Hash::make($password)])->save();
  $user->tokens()->delete();
  event(new PasswordReset($user));
  ```

---

#### S-H2 · Gym Logo Stored on Public Disk (No Auth Gate)

- **File:** `app/Http/Controllers/Api/V1/SettingController.php:38`
- **Risk:** Logo files land in `storage/app/public` which is symlinked to `public/storage` — directly web-accessible without authentication. Contrast: member photos and product images use the `local` disk and are served through authenticated controller routes.
- **Fix:** Store on `local` disk; serve through an authenticated or signed-URL endpoint.

---

#### S-H3 · OTP Brute-Force — No Per-Email Attempt Counter

- **Files:** `app/Actions/Auth/VerifyEmailOtp.php`, `app/Actions/Auth/VerifyPasswordResetOtp.php`
- **Risk:** Only IP-based rate limiting (10/min). No per-email lockout after N wrong guesses. An attacker from multiple IPs can attempt all 900,000 six-digit values. OTP-send endpoints (forgot-password, resend-verification) also have no per-email rate limit — an attacker can continuously reset the OTP to restart the brute-force window.
- **Fix:**
  1. Add `attempts` counter column to both OTP tables. Lock after 5 failures — delete the record and force a new OTP request.
  2. Rate-limit OTP-send endpoints per email: `Limit::perMinute(3)->by('otp-send:'.$email)`.

---

### 🟠 MEDIUM — Security

---

#### S-M1 · `national_id` Exposed to All Roles with `members.view`

- **File:** `app/Http/Resources/MemberResource.php:34`
- **Risk:** Cashiers and Captains receive every member's national ID on every list/detail request. The Egyptian national ID is used for identity verification with banks and government services.
- **Fix:**
  ```php
  'national_id' => $this->when(
      $request->user()?->hasRole(['Admin', 'Manager']),
      $this->national_id
  ),
  ```

---

#### S-M2 · `idempotency_key` Leaked in All Sale Responses

- **File:** `app/Http/Resources/SaleResource.php:21`
- **Risk:** Internal operational keys unnecessarily exposed to all `sales.view` callers. Omit it — the client already knows its own key.

---

#### S-M3 · `receipt_template` Stored Without Sanitization (Latent XSS)

- **File:** `app/Http/Requests/Settings/UpdateSettingsRequest.php:84`
- **Risk:** Validated as `nullable|string|max:1000` only. Currently the Blade receipt view is hardcoded, so not exploitable today. If `receipt_template` is ever rendered via `{!! !!}`, Admin-injected HTML/JS executes in members' browsers.
- **Fix:** When used in Blade, always use `{{ }}`. Add a comment in the view file to prevent future `{!! !!}` usage.

---

#### S-M4 & S-M5 · `PayrollController` Uses Untyped `$id` in 3 Methods

- **File:** `app/Http/Controllers/Api/V1/PayrollController.php:71, 82, 104`
- **Risk:** `update`, `pay`, and `payslip` receive a raw string `$id` and call `Payroll::findOrFail($id)` manually, bypassing route model binding. Inconsistent with every other controller. `UpdatePayrollRequest::authorize()` uses fragile string-based route lookup.
- **Fix:** Replace `$id` with `Payroll $payroll` route model binding in all three methods.

---

### 🟡 LOW — Security


| ID   | Issue                                                                                        | File                       |
| ---- | -------------------------------------------------------------------------------------------- | -------------------------- |
| S-L1 | OAuth `access_token` + `refresh_token` stored plaintext in `social_accounts`                 | `SocialAccount.php:23`     |
| S-L2 | No HTTP security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)                | `bootstrap/app.php`        |
| S-L3 | `store_plain_otps` dev flag could be enabled on misconfigured staging server                 | `app/Support/Otp.php:51`   |
| S-L4 | `allowed_headers: ['*']` with `supports_credentials: true` (origin lock is the real defense) | `config/cors.php:27`       |
| S-L5 | `Content-Disposition: inline` on file streaming — no type-based enforcement                  | `MemberController.php:140` |
| S-L6 | TOCTOU window in `VerifyEmailOtp` — OTP lookup not locked before deletion                    | `VerifyEmailOtp.php:22`    |


---

### ✅ SECURITY — Confirmed Correct

- Mass assignment: explicit `$fillable` everywhere, no `$guarded = []`, no `create($request->all())` ✅
- SQL injection: only two `whereRaw()` calls exist; both compare DB columns to each other, no user input interpolated ✅
- Account enumeration: login and password-reset always return identical messages regardless of email existence ✅
- OTP hashing: bcrypt via `Hash::make()`, plain-text mode guarded by `app()->environment('local')` ✅
- OTP expiry: 15-minute window enforced in query (`where('expires_at', '>', now())`) ✅
- Token revocation on logout: `currentAccessToken()->delete()` called correctly ✅
- CORS: origin locked to `env('FRONTEND_URL')` ✅
- All non-public routes: inside `auth:sanctum` group + per-route `permission:` middleware ✅
- Policies: exist for every major model (Member, Plan, Subscription, Payment, Sale, Product, Employee, Commission, Payroll, Expense, Role, AuditLog) ✅
- File uploads: MIME validated, size-limited, stored on `local` disk (not web-accessible) ✅
- Error responses: stack traces sanitized in production, `APP_DEBUG=false` gate working ✅
- Blade templates: `{{ }}` (escaped) used throughout — no `{!! !!}` found ✅
- Social login provider allowlist: double-gated via `ALLOWED_PROVIDERS` constant + route `whereIn` constraint ✅

---

## PART 2 — ARCHITECTURE & CODE QUALITY

### 🔴 HIGH — Architecture Violations

---

#### A-H1 · Business Logic in `DashboardController` (Raw SQL + Data Transformation)

- **File:** `app/Http/Controllers/Api/V1/DashboardController.php:46-103`
- **Problem:** `salesToday()` runs raw `DB::table('sales')` queries directly in the controller. `topProducts()` contains a 20-line raw SQL query, a `match` expression for date arithmetic, and a `$topProducts->map()` loop that reformats data. Controllers must only: validate → authorize → call Action → return Resource.
- **Fix:** Extract `SalesTodayReport` and `TopProductsReport` actions. Controller delegates to them.

---

#### A-H2 · 50-Line Business Logic Block in `PaymentController::index`

- **File:** `app/Http/Controllers/Api/V1/PaymentController.php:16-87`
- **Problem:** Multi-branch conditional (paid/partial vs due), raw subquery join, `map()` data transformation, and `bcsub` balance calculation — all in the controller. This is a full business logic module where a 3-line delegate should be.
- **Fix:** Extract `ListPaymentDues` action. Controller becomes one line.

---

#### A-H3 · `CommissionController` Instantiates a Console Command

- **File:** `app/Http/Controllers/Api/V1/CommissionController.php:52-57`
- **Problem:**
  ```php
  $command = new BackfillCommissionsCommand;
  $results = $command->executeBackfill($action, $request->input('from'), ...);
  ```
  The HTTP layer depends on the CLI layer. If the command changes, the HTTP endpoint silently breaks.
- **Fix:** Extract shared logic into a `BackfillCommissions` action. Both the CLI command and HTTP controller call the action.

---

#### A-H4 · N+1 in `VoidSaleAction` — `$sale->items` Lazy-Loaded Inside Transaction

- **File:** `app/Actions/Sales/VoidSaleAction.php:33-36`
- **Problem:** `foreach ($sale->items as $item)` iterates the `items` relation without eager-loading it inside the lock. For a 10-item sale: 1 item query + 10 product lock queries. The `items` relation is lazy because the action receives a `Sale` model that may not have it loaded.
- **Fix:**
  ```php
  Sale::where('id', $sale->id)->with('items')->lockForUpdate()->firstOrFail();
  ```

---

#### A-H5 · `StoreMemberPhoto` Writes File Before DB Transaction — Orphan Risk

- **File:** `app/Actions/Members/StoreMemberPhoto.php:12-19`
- **Problem:** File is stored to disk **before** the transaction opens. If `$member->update()` throws and rolls back, the file is on disk with no DB record pointing to it, and no cleanup.
- **Fix:** Remove the `DB::transaction` wrapper (single update is already atomic). Add try/catch: if `update()` fails, `Storage::disk('local')->delete($path)`.

---

#### A-H6 · `GeneratePayroll` — 2N+1 Queries in Loop

- **File:** `app/Actions/Payroll/GeneratePayroll.php:21-54`
- **Problem:** For N active employees: 1 query to load employees + N exist-checks (`Payroll::where(...)→exists()`) + N commission sums (`Commission::where(...)→sum()`) = `2N+1` queries.
- **Fix:** Pre-load existing payroll IDs and commission totals in two bulk queries before the loop, resolve from in-memory maps inside.

---

#### A-H7 · `SettingController::update` Contains Field-Mapping Logic

- **File:** `app/Http/Controllers/Api/V1/SettingController.php:28-57`
- **Problem:** 30-line block manually maps nested validated fields to flat keys, handles file upload inline, and builds `$flatSettings` conditionally. Controllers must not contain transformation + side-effect logic.
- **Fix:** Move flattening and file-upload into `UpdateSettings::handle()`.

---

### 🟠 MEDIUM — Architecture


| ID   | Issue                                                                                                     | File                                              |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| A-M1 | `memberQueryWithTotalPaid()` logic duplicated in `MembersExport`                                          | `MemberController.php:179`, `MembersExport.php`   |
| A-M2 | `AuditLogController` builds filters manually instead of using QueryBuilder `AllowedFilter`                | `AuditLogController.php:16-48`                    |
| A-M3 | `PayrollController::payslip` runs `Commission::where(...)→get()` directly in controller                   | `PayrollController.php:117`                       |
| A-M4 | `PayrollController::generate` runs `Employee::active()->count()` after Action returns                     | `PayrollController.php:57`                        |
| A-M5 | `SaleController::daily` and `report` use raw `response()->json()` instead of `$this->success()`           | `SaleController.php:116-138`                      |
| A-M6 | `SendRenewalReminderJob` has no `$tries`, no `$timeout`, no `failed()` handler                            | `app/Jobs/SendRenewalReminderJob.php`             |
| A-M7 | `CalculateCommission::forSource` fires a separate Employee lookup per call — N+1 in backfill path         | `CalculateCommission.php:27`                      |
| A-M8 | Dashboard `revenue_mtd` cache not invalidated when a `Payment` is created/updated                         | `app/Observers/`, `RecordPayment.php`             |
| A-M9 | `SubscriptionObserver` and `SaleObserver` run commission calculation synchronously (should be queued job) | `SubscriptionObserver.php:14`, `SaleObserver.php` |


---

### 🟡 LOW — Architecture


| ID   | Issue                                                                                                    | File                                                    |
| ---- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| A-L1 | `ExpenseController::store` and `update` bypass the Action layer — call `Expense::create()` directly      | `ExpenseController.php:52-61`                           |
| A-L2 | `MemberResource` patches subscription status inline (`expired` when `end_date < today`) — hides stale DB | `MemberResource.php:19`                                 |
| A-L3 | `DashboardController::salesToday` and `DashboardSummary` duplicate the same raw query                    | `DashboardController.php:48`, `DashboardSummary.php:44` |
| A-L4 | `RoleController::index` loads all roles with permissions via `→get()` — no pagination                    | `RoleController.php:22`                                 |


---

### ✅ ARCHITECTURE — Confirmed Correct

- **Controller thinness (majority):** `SubscriptionController`, `MemberController`, `AuthController`, `PlanController`, `ProductController`, `EmployeeController`, `ReportController`, `NotificationController` — all delegate cleanly to Actions ✅
- **Transaction boundaries:** All multi-table writes wrapped in `DB::transaction()` — CreateSubscription, FreezeSubscription, RenewSubscription, StopSubscription, CreateSaleAction, VoidSaleAction, MarkPayrollPaid, StoreMember ✅
- **Actions never touch HTTP layer:** Confirmed across all 50+ actions. No `request()` helper, no `Response` returns, no header reads ✅
- **Eager loading (most endpoints):** SubscriptionController loads `['member','plan','soldBy']`; SaleController loads `['items.product','payment','member','soldBy']`; MemberController loads `['latestSubscription.plan']` ✅
- **Observer safety:** No observer triggers model saves that re-trigger the observer (no infinite loops) ✅
- **Job idempotency:** All jobs safe to retry — `SendRenewalReminderJob` checks `last_reminded_on->isSameDay()`, `GenerateExportJob` uses UUID-keyed cache, `CalculateCommission` uses `firstOrCreate` ✅
- **bcmath throughout:** All currency arithmetic uses `bcadd`/`bcsub`/`bcmul`/`bccomp` at scale 2 or 4. No float math on money ✅
- **Concurrency safety:** `CreateSaleAction` and `FreezeSubscription` both use `lockForUpdate()` inside transactions ✅
- **Model `$casts`:** All date columns cast to `date`/`datetime`, decimals to `decimal:2`, booleans to `boolean` ✅

---

## PART 3 — API CONTRACT

### 🔴 HIGH — Contract Breaks

---

#### C-H1 · Missing `GET /plans/{plan}` — No Single-Plan Endpoint

- **File:** `routes/api/plans.php`
- **Problem:** `PlanController` has `index`, `store`, `update`, `toggle` but no `show`. Frontend must fetch all plans and filter client-side. Also missing from the Postman collection.
- **Fix:**
  ```php
  Route::get('/{plan}', [PlanController::class, 'show'])
      ->middleware('permission:'.MembershipPermissions::PERM_PLANS_VIEW);
  ```

---

#### C-H2 · `StorePaymentRequest` Missing `exists:subscriptions,id`

- **File:** `app/Http/Requests/Payments/StorePaymentRequest.php:18`
- **Problem:**
  ```php
  'subscription_id' => ['required', 'integer'],  // no exists:subscriptions,id
  ```
  An invalid `subscription_id` passes validation then causes `ModelNotFoundException` → 404. A FK violation must return 422, not 404.
- **Fix:** `'subscription_id' => ['required', 'integer', 'exists:subscriptions,id']`

---

#### C-H3 · `PayrollController` Bypasses Route Model Binding in 3 Methods

- **File:** `app/Http/Controllers/Api/V1/PayrollController.php:71, 82, 104`
- **Problem:** `update`, `pay`, and `payslip` use raw `$id` + `Payroll::findOrFail($id)`. Only controllers in the codebase with this pattern. Authorization in `UpdatePayrollRequest` cannot resolve the model instance properly.
- **Fix:** Use `Payroll $payroll` route model binding in all three methods.

---

#### C-H4 · `GET /payments` Returns Two Completely Different Schemas

- **File:** `app/Http/Controllers/Api/V1/PaymentController.php:19-86`
- **Problem:**
  - `?status=paid` → array of `PaymentResource`: `{id, amount, method, status, paid_at, ...}`
  - `?status=due` → completely different shape: `{subscription:{...}, member:{...}, balance, paid_total, price_paid}`
  Frontend must switch parsing logic based on the query param. Typed SDKs are impossible.
- **Fix (Option A):** Split into `GET /payments` and `GET /payments/dues` with separate shapes.

---

#### C-H5 · `StoreSubscriptionRequest.payment.method` Accepts Any String

- **File:** `app/Http/Requests/Subscriptions/StoreSubscriptionRequest.php:25`
- **Problem:** `'payment.method' => ['required', 'string', 'max:50']` — accepts `"bitcoin"`, `"barter"`, anything. `StoreSaleRequest` and `StoreMemberRequest` both correctly use `in:cash,card,bank_transfer`.
- **Fix:** `'payment.method' => ['required', 'string', 'in:cash,card,bank_transfer']`

---

### 🟠 MEDIUM — API Contract


| ID   | Issue                                                                                                                     | File                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| C-M1 | `POST /payroll/generate` returns 200 instead of 201 (creates resources)                                                   | `PayrollController.php:61`       |
| C-M2 | `SaleController::daily` and `report` use raw `response()->json()` instead of `$this->success()`                           | `SaleController.php:117-138`     |
| C-M3 | `MemberController::payments` uses manual `if (!can())` instead of `$this->authorize()` — bypasses exception handler hooks | `MemberController.php:148`       |
| C-M4 | `POST /notifications/{id}/read` should be `PATCH` (it's an update, not a create)                                          | `routes/api/notifications.php:9` |
| C-M5 | `CommissionController::index` uses untyped `$employeeId` instead of `Employee $employee` binding                          | `CommissionController.php:16`    |
| C-M6 | `MemberResource` missing `birth_date` field — column exists in DB but never returned in API                               | `MemberResource.php`             |
| C-M7 | `ExpenseController` uses `cursorPaginate(15)` while every other list endpoint uses `paginate(15)`                         | `ExpenseController.php:37`       |


---

### 🟡 LOW — API Contract


| ID   | Issue                                                                                                                                      | File                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| C-L1 | `throttle:api` applied twice to `GET /sales/{sale}/receipt` (already inherited from outer group)                                           | `routes/api/sales.php:26`   |
| C-L2 | `RoleController::show` and `update` don't explicitly call `->setStatusCode(200)` — implicit vs explicit                                    | `RoleController.php:44,53`  |
| C-L3 | Audit log date filter uses string concatenation (`$from.' 00:00:00'`) instead of Carbon — fragile with ISO 8601 input                      | `AuditLogController.php:22` |
| C-L4 | `POST /products/{id}/stock` returns 201 with a `ProductResource` body, but 201 implies the *new resource* (InventoryMovement) was returned | `ProductController.php:123` |


---

### ✅ API CONTRACT — Confirmed Correct

- All routes under `/api/v1` — no legacy routes found ✅
- All list endpoints paginated — no unbounded `→get()` on collections ✅
- Sorting bounded — all `QueryBuilder::allowedSorts()` use explicit whitelists ✅
- Error envelope consistent — all exception types produce `{error:{code,message,details}}` via `bootstrap/app.php` ✅
- 500 responses sanitized — `APP_DEBUG=false` gate working ✅
- All FK IDs except `subscription_id` (C-H2 above) validated with `exists:` ✅
- Auth on all routes — every non-public endpoint inside `auth:sanctum` group ✅
- PDF content-type correct — receipt and payslip return `application/pdf` ✅
- Idempotency on sales — `POST /sales` UUID key validates and deduplicates ✅

---

## PART 4 — PHASE GAP ANALYSIS

### 🔴 P0 Bug (Silent Data Loss)

#### G-B1 · `Member.$fillable` Missing `birth_date`

- **File:** `app/Models/Member.php`
- **Problem:** `$fillable` array: `['name','phone','email','gender','photo_path','national_id','join_date','status','notes','created_by']` — `birth_date` is absent. The migration column exists, the DB can store it, but mass-assignment silently discards it on every create and update. No error is thrown.
- **Impact:** Every member create/update silently loses `birth_date`. `MemberResource` also omits it (C-M6 above).
- **Fix:** Add `'birth_date'` to `$fillable`, to `StoreMemberRequest`/`UpdateMemberRequest` validation (`'birth_date' => ['nullable', 'date', 'before:today']`), and to `MemberResource::toArray()`. Also add `birth_date` to `MemberFactory`.

---

### 🟠 P1 — Infrastructure Not Wired


| ID   | Issue                                                                                                               | Fix                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| G-I1 | Broadcasting: `BROADCAST_CONNECTION=log` in `.env.example` — `NewSaleEvent` and renewal alerts never reach frontend | Configure Reverb or Pusher; change default to `reverb`                        |
| G-I2 | Queue/Cache: defaults to `database` driver, not Redis as the spec requires                                          | Change `.env.example` to `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`        |
| G-I3 | Storage: no S3/R2 disk configured — production images have no cloud backup path                                     | Add `AWS_`* or R2 env vars; configure second disk in `config/filesystems.php` |
| G-I4 | `SendRenewalReminderJob` dispatches DB notification only — no `ShouldBroadcast` event for real-time push            | Dispatch `SubscriptionExpiringSoonEvent` from the job (also fixes A-M6)       |


---

### 🟡 P2 — Feature Gaps


| ID   | Issue                                                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-F1 | `GET /members/{id}/payments` returns subscription payments only — sale payments for that member are excluded (`whereHasMorph` filters to `Subscription::class` only) |
| G-F2 | Shared image-upload logic duplicated between `StoreMemberPhoto` and `UpdateProduct` — no shared service                                                              |
| G-F3 | No SoftDeletes on any model — Phase 4 expected a soft-delete review pass. At minimum `Member` and `Employee` should use `SoftDeletes` to preserve historical linkage |


---

## PART 5 — TEST COVERAGE

### 🔴 Highest-Risk Gaps

---

#### T-H1 · `birth_date` Persistence — Zero Test Coverage

No test POSTs `birth_date` and asserts it persists. The known `$fillable` bug is completely invisible to the test suite — the fix has no regression guard.

---

#### T-H2 · `POST /payments` HTTP Layer Not Tested

`RecordPaymentTest` is a unit test on the Action directly. No Feature test hits `POST /api/v1/payments` through the HTTP layer — controller, FormRequest validation, Policy gate, and response shape are all untested end-to-end.

---

#### T-H3 · OTP Reuse Not Tested

Both email-verify and password-reset OTPs are deleted after use, but no test verifies that a second submission of the same OTP returns 400. If deletion is ever broken, OTPs become replayable with no test catching it.

---

#### T-H4 · Double-Operations Not Tested via HTTP

The Actions reject freeze-on-frozen, stop-on-stopped, unfreeze-on-active subscriptions — but HTTP Feature tests don't exercise these paths. A controller-level bug that bypasses the Action could go undetected.

---

#### T-H5 · Voided Sale Commission Behavior Undocumented in Tests

When a sale is voided, its commission is not reversed. This is likely intentional but there is no test documenting the decision. A future developer could "fix" this and break the business rule with no test failing.

---

### 🟠 MEDIUM — Missing Test Scenarios

**Auth:**

- Rate limiting (429) not asserted for forgot-password, resend-verification
- Social login provider exception (network error) — should be 502, not 500

**Members:**

- Duplicate phone on create — unique constraint exists in DB, no 422 test
- Delete member with active subscription — behavior undefined in tests

**Subscriptions:**

- Freeze already-frozen subscription via HTTP endpoint
- Unfreeze non-frozen subscription via HTTP endpoint
- Stop already-stopped subscription via HTTP endpoint
- Renew expired subscription (only active tested)
- Renew stopped subscription — allowed or blocked?
- Overlapping subscription creation — allowed or rejected?

**Plans:**

- Delete plan that has active subscriptions — blocked or cascade?

**Payroll:**

- Generate payroll with zero active employees
- Commission on voided sale — reversed or preserved?

**Exports:**

- Export with no data — empty file vs error

---

### 🟡 Test Quality Issues


| File                         | Issue                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `MemberPaymentsTest.php`     | First test asserts envelope shape on empty data — no payments created, `data` always empty. Redundant.                                  |
| `SubscriptionRenewTest.php`  | Only 1 test (happy path). No 401, 403, 404, invalid payment, or expired-subscription tests.                                             |
| `ExportFormatsTest.php`      | `Excel::fake()` prevents actual file generation — test only verifies download was triggered, not content.                               |
| `FreezeSubscriptionTest.php` | Under `tests/Unit/` but uses `RefreshDatabase` and seeds data — it's an integration test mislabeled. Move to `tests/Feature/`.          |
| All validation test files    | Pest datasets (`→with()`) not used anywhere. 8 copy-pasted validation test blocks in `MemberStoreTest` could be one parameterized test. |
| All Feature tests            | No custom `assertApiEnvelope()` Pest expectation — 90+ tests repeat `→has('data')→has('meta')→has('message')` manually.                 |


---

### Factory Gaps


| Factory         | Issue                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MemberFactory` | Missing `birth_date` field — consistent with the fillable bug, but means no factory-generated member ever has a birth date. Add it after fixing `$fillable`. |
| `SaleFactory`   | `member_id` defaults to `Member::factory()` — always creates a member even when testing walk-in (no-member) sales. Minor.                                    |


---

## PRIORITIZED FIX LIST

### 🔴 Must Fix Before Production (Blocking)


| Priority | ID   | What                                                         | File                                         |
| -------- | ---- | ------------------------------------------------------------ | -------------------------------------------- |
| 1        | S-H1 | Password reset must revoke all Sanctum tokens                | `ResetUserPassword.php:29`                   |
| 2        | G-B1 | Add `birth_date` to `$fillable`, requests, resource, factory | `Member.php`, `MemberResource.php`, requests |
| 3        | S-H3 | Add per-email OTP attempt counter + lockout                  | OTP models + verify actions                  |
| 4        | C-H2 | Add `exists:subscriptions,id` to `StorePaymentRequest`       | `StorePaymentRequest.php:18`                 |
| 5        | C-H5 | Validate `payment.method` as `in:cash,card,bank_transfer`    | `StoreSubscriptionRequest.php:25`            |
| 6        | S-H2 | Move logo to `local` disk + authenticated serve route        | `SettingController.php:38`                   |


---

### 🟠 (High Impact)


| Priority | ID   | What                                                          | File                              |
| -------- | ---- | ------------------------------------------------------------- | --------------------------------- |
| 7        | A-H1 | Extract `SalesTodayReport` + `TopProductsReport` actions      | `DashboardController.php:46-103`  |
| 8        | A-H2 | Extract `ListPaymentDues` action from `PaymentController`     | `PaymentController.php:16-87`     |
| 9        | A-H3 | Replace `new BackfillCommissionsCommand` with a shared Action | `CommissionController.php:52`     |
| 10       | A-H5 | Fix orphan-file risk in `StoreMemberPhoto`                    | `StoreMemberPhoto.php:12`         |
| 11       | A-H6 | Fix 2N+1 in `GeneratePayroll`                                 | `GeneratePayroll.php:21`          |
| 12       | A-H7 | Fix lazy-load of `items` in `VoidSaleAction`                  | `VoidSaleAction.php:33`           |
| 13       | C-H1 | Add `GET /plans/{plan}` route + controller method             | `routes/api/plans.php`            |
| 14       | C-H3 | Use route model binding in `PayrollController`                | `PayrollController.php:71,82,104` |
| 15       | C-H4 | Split `GET /payments` dual-schema into two endpoints          | `PaymentController.php`           |
| 16       | T-H2 | Add Feature tests for `POST /payments` HTTP layer             | `tests/Feature/Api/V1/Payments/`  |
| 17       | T-H3 | Add OTP reuse test for verify-email + verify-otp              | `tests/Feature/Api/V1/Auth/`      |
| 18       | T-H1 | Add `birth_date` persistence regression test                  | `tests/Feature/Api/V1/Members/`   |


---

### 🟡  (Medium Impact)


| Priority | ID   | What                                                                           |
| -------- | ---- | ------------------------------------------------------------------------------ |
| 19       | G-I1 | Configure Reverb/Pusher broadcasting                                           |
| 20       | G-I2 | Change queue/cache defaults to Redis in `.env.example`                         |
| 21       | A-M6 | Add `$tries`, `$timeout`, `failed()` to `SendRenewalReminderJob`               |
| 22       | A-M8 | Add cache invalidation on `Payment` created/updated                            |
| 23       | A-M9 | Dispatch commission calculation as queued job (not sync in observer)           |
| 24       | S-M1 | Restrict `national_id` in `MemberResource` to Admin/Manager only               |
| 25       | C-M4 | Change `POST /notifications/{id}/read` to `PATCH`                              |
| 26       | C-M7 | Change `ExpenseController` from `cursorPaginate` to `paginate` for consistency |
| 27       | T-H4 | Add HTTP tests for double-operations (freeze-frozen, stop-stopped)             |
| 28       | T-H5 | Add test documenting voided-sale commission behavior                           |


---

### 🔵  (Low)


| ID   | Topic                                                                          |
| ---- | ------------------------------------------------------------------------------ |
| G-F3 | SoftDeletes — add to `Member` and `Employee` at minimum for historical linkage |
| G-F1 | Extend `GET /members/{id}/payments` to include sale payments                   |
| G-I3 | Configure S3/R2 for production file storage                                    |
| G-I4 | Add `SubscriptionExpiringSoonEvent` broadcast for real-time renewal reminders  |
| S-M2 | Remove `idempotency_key` from `SaleResource` response                          |


---

*Reports: `SECURITY-REVIEW.md` · `ARCHITECTURE-REVIEW.md` · `API-CONTRACT-REVIEW.md` · `TEST-COVERAGE-REVIEW.md` · `REVIEW-REPORT.md`*