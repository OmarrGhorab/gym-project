# Feature Specification: Permissions Matrix, Audit, Export & Branding

**Feature Branch**: `005-permissions-audit-branding`

**Created**: 2026-06-11

**Status**: Draft

**Input**: Phase 4 — Permissions Matrix, Audit, Export, Branding & QA (hardening and finalization across all modules built in Phases 0–3)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Permission Matrix with Roles (Priority: P1)

A gym administrator manages who can do what across the entire platform. The administrator can view the full catalog of available permissions (every action in every module: members, subscriptions, plans, products, sales, payments, employees, payroll, commissions, reports, settings, audit, export), assign permissions to roles, apply built-in role presets (Admin, Manager, Cashier, Captain, Accountant), and create custom roles with a hand-picked set of permissions. Once a role's permissions change, the people holding that role immediately gain or lose access to the corresponding actions.

**Why this priority**: Without a complete, enforced permission matrix, every endpoint is either wide open or inconsistently guarded — a direct security gap. All other Phase 4 capabilities (audit visibility, export, branding administration) themselves need to be permission-gated, so the matrix is the foundation everything else rests on.

**Independent Test**: Can be fully tested by listing all permissions, creating a custom role with a chosen subset, assigning it to a user, and confirming the user can perform exactly the permitted actions and is refused (403) on every other action — without touching audit, export, or branding.

**Acceptance Scenarios**:

1. **Given** I am an authorized administrator, **When** I request the list of permissions, **Then** I receive every action across every module in a single catalog.
2. **Given** the built-in role presets, **When** I inspect the Admin, Manager, Cashier, Captain, and Accountant roles, **Then** each carries a documented, sensible set of permissions appropriate to that job.
3. **Given** I am an authorized administrator, **When** I create a custom role and assign it a chosen subset of permissions, **Then** the role is saved and can be assigned to users.
4. **Given** a user holds a role lacking permission X, **When** that user attempts the action guarded by X, **Then** the request is refused with a 403 and the denial is recorded.
5. **Given** a user holds a role, **When** an administrator adds permission X to that role, **Then** the user can perform action X on their next request without re-login.
6. **Given** a non-administrator, **When** they attempt to view or edit roles/permissions, **Then** the request is refused with a 403.
7. **Given** every non-public endpoint across all modules, **When** it is called without the required permission, **Then** it consistently returns 403 (no endpoint is ungated).

---

### User Story 2 - Audit Log Viewer (Priority: P1)

A manager or administrator needs to answer "who changed what, and when" across the whole system. They open the audit log and see a chronological record of meaningful business events — member created, subscription renewed, sale completed, payment recorded, role changed, payroll marked paid, settings updated — each entry showing the actor (causer), the affected record (subject), the action, and the timestamp. They can filter by subject type, by causer, and by date range to investigate a specific incident.

**Why this priority**: Audit visibility is an accountability and security requirement that becomes meaningful only once data exists across all modules (Phases 0–3). It is independent of export and branding and delivers standalone value for compliance and incident investigation.

**Independent Test**: Can be fully tested by performing a set of recorded actions (create a member, change a role, record a payment), then querying the audit log and confirming each event appears with correct causer, subject, action, and time, and that the subject/causer/date filters narrow results correctly.

**Acceptance Scenarios**:

1. **Given** business actions have occurred across modules, **When** an authorized user opens the audit log, **Then** they see entries with who (causer), what (subject + action), and when (timestamp), newest first.
2. **Given** many audit entries exist, **When** the user filters by subject type, **Then** only entries affecting that record type are returned.
3. **Given** many audit entries exist, **When** the user filters by causer, **Then** only entries caused by that user are returned.
4. **Given** many audit entries exist, **When** the user filters by a date range, **Then** only entries within that range are returned, and filters combine.
5. **Given** a long audit history, **When** the user requests it, **Then** results are paginated rather than returned unbounded.
6. **Given** a user without the audit-view permission, **When** they request the audit log, **Then** the request is refused with a 403.
7. **Given** every business model across Phases 1–3, **When** it is created, updated, or deleted, **Then** a corresponding audit entry is recorded.

---

### User Story 3 - Universal Data Export (Priority: P2)

Staff need to take data out of the system for accounting, reporting, and record-keeping. From any major list or report — members, subscriptions, sales, payments, payroll, and financial/performance reports — an authorized user can export the current view, honoring the same filters they see on screen, to Excel, CSV, or PDF. Small exports download immediately; large exports are prepared in the background and the user is given a link to download the finished file when it is ready. A user can only export data they are permitted to see.

**Why this priority**: Export is high-value but depends on the data and list/report endpoints from Phases 1–3 already existing, and on the permission matrix (US1) to gate access. It is valuable on its own once those exist, hence P2.

**Independent Test**: Can be fully tested by requesting an export of a permitted resource in each format and confirming the file contents match the filtered data, that a large export returns a job/handle and later a working download link, and that a user lacking the resource's view permission is refused.

**Acceptance Scenarios**:

1. **Given** an authorized user viewing a resource list with filters applied, **When** they export it, **Then** the exported file contains exactly the filtered rows in the requested format (Excel, CSV, or PDF).
2. **Given** a small dataset, **When** the user exports it, **Then** the file is returned promptly for immediate download.
3. **Given** a large dataset, **When** the user requests an export, **Then** the export is processed in the background and the user receives a way to retrieve the completed file once ready.
4. **Given** a user lacking permission to view a resource, **When** they attempt to export it, **Then** the request is refused with a 403 and no file is produced.
5. **Given** an unsupported format or unknown resource, **When** an export is requested, **Then** the request is rejected with a clear validation error.
6. **Given** an export is requested, **When** it runs, **Then** the action is recorded in the audit log with the requesting user and resource.

---

### User Story 4 - System Settings & ATP Branding (Priority: P2)

An administrator configures the platform's identity and business rules in one place: the business name, brand colors, logo, the membership-expiry reminder window (reminder days), currency, VAT rate, and the receipt template. These settings are read by the rest of the platform — the reminder window drives subscription expiry notices (Phase 1), VAT and the receipt template drive POS receipts (Phase 2), and the name/colors/logo drive the dashboard's visual identity (ATP branding).

**Why this priority**: Branding and settings polish the product and centralize configuration that earlier phases seeded, but no other Phase 4 capability depends on it, so it ranks alongside export at P2.

**Independent Test**: Can be fully tested by reading the current settings, updating each field (name, colors, logo, reminder days, currency, VAT, receipt template), reading them back to confirm persistence, and confirming a non-administrator is refused.

**Acceptance Scenarios**:

1. **Given** I am an authorized administrator, **When** I read the settings, **Then** I receive the current business name, colors, logo reference, reminder days, currency, VAT rate, and receipt template.
2. **Given** I am an authorized administrator, **When** I update one or more settings with valid values, **Then** the new values persist and are returned on the next read.
3. **Given** invalid setting values (e.g., a negative reminder window or VAT outside 0–100%), **When** I attempt to save them, **Then** the request is rejected with a clear validation error.
4. **Given** updated branding (name/colors/logo), **When** the dashboard loads, **Then** it reflects the configured ATP identity.
5. **Given** a non-administrator, **When** they attempt to update settings, **Then** the request is refused with a 403.
6. **Given** settings are changed, **When** the change is saved, **Then** it is recorded in the audit log.

---

### User Story 5 - Responsive & RTL QA Sweep (Priority: P3)

Across every page of the dashboard, the experience is verified to work correctly on desktop and mobile, in right-to-left (Arabic) layout, with polished empty, loading, and error states, and a final bug-fix pass closes defects found during the sweep.

**Why this priority**: This is the quality-assurance wrap that depends on all features being present and is the last thing done before sign-off; it adds no new capability, so it is P3.

**Independent Test**: Can be fully tested by walking every page on desktop and a mobile viewport in RTL mode and confirming layout integrity, correct mirroring, and that empty/loading/error states render without breakage.

**Acceptance Scenarios**:

1. **Given** any dashboard page, **When** viewed on a desktop viewport, **Then** the layout renders correctly without overflow or overlap.
2. **Given** any dashboard page, **When** viewed on a mobile viewport, **Then** content reflows usably without horizontal scrolling.
3. **Given** RTL (Arabic) mode, **When** any page renders, **Then** text direction, alignment, and component mirroring are correct.
4. **Given** a list or report with no data, **When** it loads, **Then** a clear empty state is shown instead of a broken layout.
5. **Given** a slow or failed request, **When** a page loads, **Then** an appropriate loading indicator or error state is shown.

---

### Edge Cases

- What happens when an administrator removes the last permission that would let anyone manage roles — does the system prevent locking everyone out of administration?
- How does the system handle a role being deleted while users are still assigned to it?
- What happens when a permission referenced by a preset does not exist (e.g., a module's permissions were not registered)?
- How does export behave when the underlying data changes between the time a large export job is queued and when it runs?
- What happens when a queued export job fails — is the requester informed and is the failure recorded?
- How long does a completed export download link remain valid, and what happens to expired or already-downloaded files?
- How does the audit log represent an action taken by the system itself (e.g., a scheduled job) rather than a human causer?
- What happens when an audit date-range filter has the "from" date after the "to" date?
- How does the system behave when a logo upload exceeds size limits or is an unsupported file type?
- What happens to in-flight sessions when a user's role is downgraded mid-session?

## Requirements *(mandatory)*

### Functional Requirements

#### Permissions & Roles

- **FR-001**: System MUST expose a single catalog listing every permission across all modules (members, subscriptions, plans, products, sales, payments, employees, payroll, commissions, reports, settings, audit, export).
- **FR-002**: System MUST provide built-in role presets — Admin, Manager, Cashier, Captain, Accountant — each with a defined, documented set of permissions.
- **FR-003**: System MUST allow authorized administrators to create, read, update, and delete custom roles.
- **FR-004**: System MUST allow authorized administrators to assign one or more roles to a user and to change a user's roles.
- **FR-005**: System MUST enforce the relevant permission on every non-public endpoint across all modules, returning 403 when the caller lacks it; no endpoint may be left ungated.
- **FR-006**: System MUST reflect a role's permission changes in the access decisions for users holding that role without requiring those users to re-authenticate.
- **FR-007**: System MUST restrict role and permission management to administrators holding the appropriate permission.
- **FR-008**: System MUST prevent an administrative change that would leave no one able to manage roles and permissions (no total lock-out).

#### Audit Log

- **FR-009**: System MUST record an audit entry for create, update, and delete on every business model across Phases 1–3 (members, subscriptions, plans, products, sales, payments, employees, payroll, commissions) and for security-relevant events (role/permission changes, settings changes, exports).
- **FR-010**: Each audit entry MUST capture the causer (acting user, or system when no user), the subject (affected record type and identifier), the action performed, and the timestamp.
- **FR-011**: System MUST provide an audit-log query that supports filtering by subject type, by causer, and by date range, with filters combinable.
- **FR-012**: System MUST paginate audit-log results and order them newest-first by default.
- **FR-013**: System MUST gate audit-log access behind a dedicated permission and refuse unauthorized callers with 403.
- **FR-014**: Audit entries MUST NOT contain secrets or sensitive credentials.

#### Export

- **FR-015**: System MUST support exporting members, subscriptions, sales, payments, payroll, and reports.
- **FR-016**: System MUST support Excel, CSV, and PDF output formats for export.
- **FR-017**: Export MUST honor the same filters that apply to the corresponding list/report view, so the exported data matches the on-screen result.
- **FR-018**: System MUST gate each export behind the same permission required to view the underlying resource, refusing unauthorized requests with 403.
- **FR-019**: System MUST process large exports in the background and provide the requester a means to retrieve the completed file when ready, rather than blocking the request.
- **FR-020**: System MUST validate the requested resource and format and reject unknown resources or unsupported formats with a clear validation error.
- **FR-021**: System MUST record each export request in the audit log, and MUST record export job failures so the requester can be informed.

#### Settings & Branding

- **FR-022**: System MUST expose readable and updatable settings for business name, brand colors, logo, reminder days, currency, VAT rate, and receipt template.
- **FR-023**: System MUST validate setting values (e.g., reminder days non-negative, VAT within a valid percentage range, colors well-formed, logo within size/type limits) and reject invalid input with a clear error.
- **FR-024**: System MUST make settings consumable by other modules — reminder days by subscription expiry reminders, VAT and receipt template by POS receipts, and name/colors/logo by the dashboard identity.
- **FR-025**: System MUST restrict settings changes to authorized administrators, refusing others with 403.
- **FR-026**: System MUST record settings changes in the audit log.

#### Security & Performance Hardening

- **FR-027**: System MUST rate-limit sensitive endpoints — at minimum login, point-of-sale, and export.
- **FR-028**: System MUST restrict cross-origin access to the dashboard origin.
- **FR-029**: System MUST use an explicit field allowlist for mass assignment and hide sensitive fields on all models (no blanket-unguarded models).
- **FR-030**: System MUST ensure every column used for filtering, joining, ordering, or as a foreign key across all modules is indexed, and unbounded collections are paginated.
- **FR-031**: System MUST return the standard success response envelope and the standard stable error shape for these endpoints, with correct HTTP status codes, under `/api/v1`.

#### Responsive / RTL QA

- **FR-032**: The dashboard MUST render correctly on desktop and mobile viewports across every page.
- **FR-033**: The dashboard MUST render correctly in right-to-left (Arabic) layout, with correct text direction, alignment, and component mirroring.
- **FR-034**: Every list and report MUST present clear empty, loading, and error states.

### Key Entities *(include if feature involves data)*

- **Permission**: A named, fine-grained action in a module (e.g., "members.create", "reports.view"). The catalog of all permissions is the basis of the matrix. No new storage introduced beyond what Phase 0 established.
- **Role**: A named bundle of permissions, either a built-in preset (Admin, Manager, Cashier, Captain, Accountant) or a custom role. Assigned to users; a user may hold multiple roles.
- **Audit Entry**: A record of one meaningful event — causer (acting user or system), subject (affected record type + identifier), action/description, changed attributes (non-sensitive), and timestamp. Stored in the Phase 0 activity log.
- **Setting**: A configuration key/value for the platform — name, colors, logo, reminder days, currency, VAT rate, receipt template. Stored in the Phase 0 settings store; read by Phases 1–3.
- **Export Request**: A user's request to extract a resource in a given format with given filters; may be immediate or a background job with a retrievable result and a recorded outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of non-public endpoints across all modules require and enforce a permission; an automated check finds zero ungated non-public endpoints.
- **SC-002**: An administrator can create a custom role and apply it to a user, and the user's allowed and denied actions match the role exactly, in under 2 minutes and without that user re-authenticating.
- **SC-003**: The five built-in role presets exist and each holds the documented permission set on a fresh install.
- **SC-004**: For any meaningful create/update/delete across all modules, a matching audit entry is retrievable showing the correct who, what, and when in 100% of sampled actions.
- **SC-005**: An investigator can locate all actions by a specific user within a specific date range using filters in under 30 seconds.
- **SC-006**: Every listed resource (members, subscriptions, sales, payments, payroll, reports) can be exported successfully in all three formats (Excel, CSV, PDF).
- **SC-007**: A large export (e.g., tens of thousands of rows) completes via background processing and yields a working download without the original request timing out.
- **SC-008**: A user without view permission for a resource is refused export of that resource 100% of the time.
- **SC-009**: All seven settings fields can be updated and read back accurately, and downstream modules reflect the changed values (reminder window, VAT/receipt, branding).
- **SC-010**: Every dashboard page renders without layout defects on desktop and mobile and in RTL mode, verified across the full page inventory.
- **SC-011**: The full automated test suite passes, including smoke coverage for permissions enforcement and export.

## Assumptions

- The roles/permissions foundation, activity-log store, and settings store were established in Phase 0; this phase consolidates and completes them rather than introducing new persistence.
- Permissions for each module were registered by their respective phases (P1 members/subscriptions/plans, P2 products/sales/payments, P3 employees/payroll/commissions/reports); this phase composes them into the final matrix and presets.
- No new business tables are introduced; only the existing `settings` and `activity_log` stores and previously-added indexes are used and finalized.
- The standard `/api/v1` response envelope, authentication, and error shape from Phase 0 apply to all new endpoints here.
- The five role presets (Admin, Manager, Cashier, Captain, Accountant) are the agreed set; custom roles cover any additional needs.
- Completed export files are retained for a limited, industry-standard window and then cleaned up; download links are scoped to authorized users.
- VAT rate, currency, and the receipt template are confirmed with the client before the template is locked, per the phase notes.
- The dashboard (frontend) is a separate concern consuming these APIs; backend deliverables are the APIs, gating, audit, export, and settings, while responsive/RTL QA is verified against the dashboard that consumes them.
- "System" causer is used for audit entries generated by scheduled jobs or background processes with no human actor.
