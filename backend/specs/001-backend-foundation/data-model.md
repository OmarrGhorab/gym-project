# Data Model: Backend Phase 0 Foundation

## Existing Tables

### users

**Status**: Already present.

**Purpose**: Internal staff login accounts.

**Relevant fields**:

- `id`
- `name`
- `email`
- `email_verified_at`
- `password`
- `remember_token`
- `created_at`
- `updated_at`

**Implementation notes**:

- `email` is already unique.
- `password` and `remember_token` are already hidden on the model.
- Add API token trait/support during auth implementation.

### password_reset_tokens

**Status**: Already present.

**Purpose**: Password reset support.

### sessions

**Status**: Already present.

**Purpose**: Session support if used later.

### cache and cache_locks

**Status**: Already present.

**Purpose**: Database cache fallback and lock support.

### jobs, job_batches, failed_jobs

**Status**: Already present.

**Purpose**: Queue and failed-job observability support.

## New Tables Required

### personal_access_tokens

**Source**: Sanctum migration.

**Purpose**: Stores revocable API tokens for staff users.

**Relationships**:

- Token belongs to a tokenable user.

**Important behavior**:

- Created on successful login.
- Current token is revoked on logout.

### roles

**Source**: Permission package migration.

**Purpose**: Named staff responsibility groups.

**Seed values**:

- Admin
- Manager
- Cashier
- Captain
- Accountant

### permissions

**Source**: Permission package migration.

**Purpose**: Granular backend capabilities.

**Seed values for Phase 0**:

- `foundation.access-sample`

### model_has_roles

**Source**: Permission package migration.

**Purpose**: Assigns roles to users.

### model_has_permissions

**Source**: Permission package migration.

**Purpose**: Assigns direct permissions to users when needed.

### role_has_permissions

**Source**: Permission package migration.

**Purpose**: Assigns permissions to roles.

### activity_log

**Source**: Activity log package migration.

**Purpose**: Records tracked security or administrative events.

**Required Phase 0 proof**:

- At least one tracked event with actor, event name, context, and timestamp.
- No passwords, tokens, secrets, or full sensitive personal information in properties.

### settings

**Source**: App migration.

**Purpose**: Stores foundation key/value configuration consumed by later phases.

**Fields**:

- `id`
- `key` unique string
- `value` JSON
- `created_at`
- `updated_at`

**Indexes**:

- Unique index on `key`.

**Validation**:

- Key is required and unique.
- Value must be valid JSON-compatible data.

## Non-Entities In This Phase

- Members
- Plans
- Subscriptions
- Payments
- Products
- Sales
- Inventory movements
- Employees
- Payroll
- Reports
- Frontend dashboard state
