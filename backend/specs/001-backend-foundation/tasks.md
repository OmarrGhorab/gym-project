# Tasks: Backend Phase 0 Foundation

**Input**: Design documents from `/specs/001-backend-foundation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: Required by the feature specification and constitution. Write Pest tests first and confirm they fail before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared foundation is complete.

## Phase 1: Setup (Shared Backend Dependencies)

**Purpose**: Add only the backend packages/configuration needed for Phase 0. Do not reinitialize Laravel or touch Next.js/frontend setup.

- [ ] T001 Update backend dependencies for Sanctum, Spatie Permission, Spatie Activitylog, Spatie Query Builder, Maatwebsite Excel, Barryvdh DomPDF, and Pest in `composer.json` and `composer.lock`
- [ ] T002 Publish Sanctum configuration and migration files to `config/sanctum.php` and `database/migrations/*_create_personal_access_tokens_table.php`
- [ ] T003 Publish Spatie Permission configuration and migration files to `config/permission.php` and `database/migrations/*_create_permission_tables.php`
- [ ] T004 Publish Spatie Activitylog configuration and migration files to `config/activitylog.php` and `database/migrations/*_create_activity_log_table.php`
- [ ] T005 [P] Configure Pest bootstrap in `tests/Pest.php`
- [ ] T006 Remove placeholder example tests from `tests/Feature/ExampleTest.php` and `tests/Unit/ExampleTest.php`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish conventions and shared infrastructure that all user stories depend on.

**Critical**: No user story work should begin until this phase is complete.

- [ ] T007 Run and record the pre-implementation Laravel architecture review outcome in `specs/001-backend-foundation/reviews/architecture.md`
- [ ] T008 Register API routing for `routes/api.php` in `bootstrap/app.php`
- [ ] T009 Create the `/api/v1` route group skeleton in `routes/api.php`
- [ ] T010 Create base API response helpers in `app/Http/Responses/ApiResponse.php`
- [ ] T011 Create base API controller behavior in `app/Http/Controllers/Api/V1/ApiController.php`
- [ ] T012 Create uniform exception rendering for JSON API errors in `bootstrap/app.php`
- [ ] T013 Create shared API resource envelope behavior in `app/Http/Resources/Concerns/WrapsApiResponse.php`
- [ ] T014 Update `app/Models/User.php` with Sanctum token support while preserving `$fillable`, `$hidden`, and casts
- [ ] T015 Create foundation role and permission constants in `app/Support/FoundationPermissions.php`
- [ ] T016 Create foundation roles and permissions seeder in `database/seeders/FoundationAccessSeeder.php`
- [ ] T017 Update `database/seeders/DatabaseSeeder.php` to call `database/seeders/FoundationAccessSeeder.php` without adding business-module seed data

**Checkpoint**: API routing, response/error conventions, token-capable users, and seed structure are ready.

---

## Phase 3: User Story 1 - Verify Platform Availability (Priority: P1) MVP

**Goal**: A client can confirm backend availability through a public health endpoint using the standard response contract.

**Independent Test**: Request `GET /api/v1/health` and verify status `200` with `{ data, meta, message }`.

### Tests for User Story 1

- [ ] T018 [P] [US1] Create failing Pest test for successful health response in `tests/Feature/Api/V1/HealthTest.php`
- [ ] T019 [P] [US1] Create failing Pest test for standard 404 JSON error shape in `tests/Feature/Api/V1/ErrorContractTest.php`

### Implementation for User Story 1

- [ ] T020 [US1] Create health controller in `app/Http/Controllers/Api/V1/HealthController.php`
- [ ] T021 [US1] Register `GET /api/v1/health` in `routes/api.php`
- [ ] T022 [US1] Implement standard not-found error handling in `bootstrap/app.php`
- [ ] T023 [US1] Update endpoint documentation for health and 404 behavior in `specs/001-backend-foundation/contracts/api.md`
- [ ] T024 [US1] Run focused health/error contract tests with `tests/Feature/Api/V1/HealthTest.php` and `tests/Feature/Api/V1/ErrorContractTest.php`

**Checkpoint**: User Story 1 is independently functional and is the MVP validation slice.

---

## Phase 4: User Story 2 - Authenticate Staff Users (Priority: P1)

**Goal**: Staff users can sign in, inspect their current account, and sign out with revocable API tokens.

**Independent Test**: Create a staff user, log in, call `/auth/me`, log out, then confirm the old token no longer works.

### Tests for User Story 2

- [ ] T025 [P] [US2] Create failing Pest tests for valid login, invalid login, and login validation errors in `tests/Feature/Api/V1/Auth/LoginTest.php`
- [ ] T026 [P] [US2] Create failing Pest tests for current-user auth required and success cases in `tests/Feature/Api/V1/Auth/CurrentUserTest.php`
- [ ] T027 [P] [US2] Create failing Pest tests for logout token revocation in `tests/Feature/Api/V1/Auth/LogoutTest.php`

### Implementation for User Story 2

- [ ] T028 [P] [US2] Create login form request in `app/Http/Requests/Auth/LoginRequest.php`
- [ ] T029 [P] [US2] Create current-user API resource in `app/Http/Resources/UserResource.php`
- [ ] T030 [US2] Create login action in `app/Actions/Auth/LoginStaffUser.php`
- [ ] T031 [US2] Create logout action in `app/Actions/Auth/LogoutStaffUser.php`
- [ ] T032 [US2] Create auth controller in `app/Http/Controllers/Api/V1/AuthController.php`
- [ ] T033 [US2] Register `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout` in `routes/api.php`
- [ ] T034 [US2] Add auth route throttling for login and sensitive auth routes in `routes/api.php`
- [ ] T035 [US2] Implement standard `401`, `422`, and `429` API error handling in `bootstrap/app.php`
- [ ] T036 [US2] Update auth endpoint documentation in `specs/001-backend-foundation/contracts/api.md`
- [ ] T037 [US2] Run focused auth tests in `tests/Feature/Api/V1/Auth/LoginTest.php`, `tests/Feature/Api/V1/Auth/CurrentUserTest.php`, and `tests/Feature/Api/V1/Auth/LogoutTest.php`

**Checkpoint**: User Story 2 works independently after the shared foundation.

---

## Phase 5: User Story 3 - Enforce Role-Based Access (Priority: P1)

**Goal**: The backend proves role/permission enforcement through a sample protected capability.

**Independent Test**: A user with `foundation.access-sample` receives `200`; an authenticated user without it receives `403`; an unauthenticated caller receives `401`.

### Tests for User Story 3

- [ ] T038 [P] [US3] Create failing Pest tests for foundation role and permission seeding in `tests/Feature/Foundation/FoundationAccessSeederTest.php`
- [ ] T039 [P] [US3] Create failing Pest tests for sample protected route auth required, forbidden, and allowed cases in `tests/Feature/Api/V1/Foundation/ProtectedSampleTest.php`

### Implementation for User Story 3

- [ ] T040 [US3] Implement roles, permissions, and Admin permission assignment in `database/seeders/FoundationAccessSeeder.php`
- [ ] T041 [US3] Create sample protected controller in `app/Http/Controllers/Api/V1/Foundation/ProtectedSampleController.php`
- [ ] T042 [US3] Register permission-protected `GET /api/v1/foundation/protected-sample` in `routes/api.php`
- [ ] T043 [US3] Implement standard `403` API error handling in `bootstrap/app.php`
- [ ] T044 [US3] Update protected sample endpoint documentation in `specs/001-backend-foundation/contracts/api.md`
- [ ] T045 [US3] Run focused permission tests in `tests/Feature/Foundation/FoundationAccessSeederTest.php` and `tests/Feature/Api/V1/Foundation/ProtectedSampleTest.php`

**Checkpoint**: User Story 3 works independently after auth and foundation access seeding.

---

## Phase 6: User Story 4 - Record Administrative Activity (Priority: P2)

**Goal**: At least one security-relevant or administrative action creates a safe audit record.

**Independent Test**: Perform the tracked action and verify an `activity_log` row exists without secrets, passwords, or tokens.

### Tests for User Story 4

- [ ] T046 [P] [US4] Create failing Pest test for audit record creation on selected foundation action in `tests/Feature/Foundation/AuditLogTest.php`
- [ ] T047 [P] [US4] Create failing Pest test that audit properties exclude tokens and passwords in `tests/Feature/Foundation/AuditPrivacyTest.php`

### Implementation for User Story 4

- [ ] T048 [US4] Create audit logging action for foundation events in `app/Actions/Foundation/RecordFoundationActivity.php`
- [ ] T049 [US4] Integrate audit logging with the selected tracked action in `app/Http/Controllers/Api/V1/Foundation/ProtectedSampleController.php`
- [ ] T050 [US4] Configure activity log defaults for safe event properties in `config/activitylog.php`
- [ ] T051 [US4] Run focused audit tests in `tests/Feature/Foundation/AuditLogTest.php` and `tests/Feature/Foundation/AuditPrivacyTest.php`

**Checkpoint**: User Story 4 is independently verifiable by inspecting audit test assertions.

---

## Phase 7: User Story 5 - Store Core Settings and Infrastructure Readiness (Priority: P2)

**Goal**: Foundation settings and backend infrastructure readiness are proven without adding dashboard UI.

**Independent Test**: Store/read a branding placeholder setting, dispatch a probe job, verify cache and storage paths, and confirm realtime config is safe.

### Tests for User Story 5

- [ ] T052 [P] [US5] Create failing Pest tests for storing and reading a foundation setting in `tests/Unit/Actions/Settings/StoreSettingTest.php`
- [ ] T053 [P] [US5] Create failing Pest test for queue probe dispatch and completion in `tests/Feature/Foundation/QueueProbeTest.php`
- [ ] T054 [P] [US5] Create failing Pest test for cache readiness in `tests/Feature/Foundation/CacheReadinessTest.php`
- [ ] T055 [P] [US5] Create failing Pest test for storage readiness in `tests/Feature/Foundation/StorageReadinessTest.php`
- [ ] T056 [P] [US5] Create failing Pest test for broadcast/realtime configuration readiness in `tests/Feature/Foundation/BroadcastReadinessTest.php`

### Implementation for User Story 5

- [ ] T057 [US5] Create settings migration in `database/migrations/*_create_settings_table.php`
- [ ] T058 [US5] Create setting model with explicit `$fillable` and casts in `app/Models/Setting.php`
- [ ] T059 [US5] Create store/read setting action in `app/Actions/Settings/StoreSetting.php`
- [ ] T060 [US5] Create foundation probe job in `app/Jobs/FoundationProbeJob.php`
- [ ] T061 [US5] Create infrastructure readiness action in `app/Actions/Foundation/CheckInfrastructureReadiness.php`
- [ ] T062 [US5] Add remote-compatible storage disk configuration in `config/filesystems.php`
- [ ] T063 [US5] Add safe broadcast/realtime readiness configuration in `config/services.php`
- [ ] T064 [US5] Run focused readiness tests in `tests/Unit/Actions/Settings/StoreSettingTest.php`, `tests/Feature/Foundation/QueueProbeTest.php`, `tests/Feature/Foundation/CacheReadinessTest.php`, `tests/Feature/Foundation/StorageReadinessTest.php`, and `tests/Feature/Foundation/BroadcastReadinessTest.php`

**Checkpoint**: User Story 5 proves settings plus queue/cache/storage/realtime readiness.

---

## Phase 8: Polish & Cross-Cutting Quality Gates

**Purpose**: Validate the full backend Phase 0 foundation against the mandatory workflow.

- [ ] T065 Update backend validation steps in `specs/001-backend-foundation/quickstart.md`
- [ ] T066 [P] Update generated API contract details in `specs/001-backend-foundation/contracts/api.md`
- [ ] T067 Run formatting and record result in `specs/001-backend-foundation/reviews/formatting.md`
- [ ] T068 Run full backend test suite and record result in `specs/001-backend-foundation/reviews/tests.md`
- [ ] T069 Run security review and record findings in `specs/001-backend-foundation/reviews/security.md`
- [ ] T070 Run performance review and record findings in `specs/001-backend-foundation/reviews/performance.md`
- [ ] T071 Run final code review and record findings in `specs/001-backend-foundation/reviews/code-review.md`
- [ ] T072 Run release readiness audit and record verdict in `specs/001-backend-foundation/reviews/release-readiness.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1.
- **Phase 3 User Story 1**: Depends on Phase 2 and is the MVP.
- **Phase 4 User Story 2**: Depends on Phase 2; practically needs response/error conventions from US1.
- **Phase 5 User Story 3**: Depends on Phase 4 because permission checks require authenticated users.
- **Phase 6 User Story 4**: Depends on Phase 5 because the selected tracked action is the sample protected route.
- **Phase 7 User Story 5**: Depends on Phase 2 and can run after US1 if staffed separately.
- **Phase 8 Polish**: Depends on all implemented stories.

### User Story Dependencies

- **US1 Verify Platform Availability**: First MVP slice after foundation.
- **US2 Authenticate Staff Users**: Depends on shared response/error foundation.
- **US3 Enforce Role-Based Access**: Depends on US2 auth and seeded permissions.
- **US4 Record Administrative Activity**: Depends on US3 sample protected route.
- **US5 Store Core Settings and Infrastructure Readiness**: Depends on shared foundation; independent of US2-US4 except for final full-suite validation.

### Within Each User Story

- Tests must be written first and fail before implementation.
- Data/model tasks before actions/services.
- Actions/services before controllers/endpoints.
- Endpoint docs updated after behavior is implemented.
- Focused tests run before moving to the next checkpoint.

---

## Parallel Opportunities

- T005 can run while T002-T004 package publish tasks are prepared.
- T018 and T019 can be written in parallel.
- T025, T026, and T027 can be written in parallel.
- T028 and T029 can be implemented in parallel.
- T038 and T039 can be written in parallel.
- T046 and T047 can be written in parallel.
- T052 through T056 can be written in parallel.
- T066 can run in parallel with non-document review tasks once endpoint behavior is final.

---

## Parallel Example: User Story 5

```text
Task: "Create failing Pest tests for storing and reading a foundation setting in tests/Unit/Actions/Settings/StoreSettingTest.php"
Task: "Create failing Pest test for queue probe dispatch and completion in tests/Feature/Foundation/QueueProbeTest.php"
Task: "Create failing Pest test for cache readiness in tests/Feature/Foundation/CacheReadinessTest.php"
Task: "Create failing Pest test for storage readiness in tests/Feature/Foundation/StorageReadinessTest.php"
Task: "Create failing Pest test for broadcast/realtime configuration readiness in tests/Feature/Foundation/BroadcastReadinessTest.php"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 User Story 1.
4. Stop and validate `GET /api/v1/health` plus the response/error envelope.

### Incremental Delivery

1. US1 proves API availability and response contracts.
2. US2 adds staff authentication.
3. US3 adds permission enforcement.
4. US4 adds audit proof.
5. US5 adds settings and infrastructure readiness.

### Mandatory Workflow Mapping

1. Analyze requirements: completed in spec/plan, reaffirm before T007.
2. Review architecture: T007.
3. Implement feature: T001-T064, test-first within each story.
4. Run tests: T068.
5. Run security review: T069.
6. Run performance review: T070.
7. Run final code review: T071 and T072.

## Notes

- `[P]` means the task touches a distinct file and can be done in parallel once dependencies are met.
- `[US#]` maps each task to the corresponding user story in `spec.md`.
- Every endpoint must preserve `/api/v1` versioning and the documented response shapes.
- Do not add Next.js, dashboard, RTL layout, or frontend implementation tasks to this backend Phase 0 list.
