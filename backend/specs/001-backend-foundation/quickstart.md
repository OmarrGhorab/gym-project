# Quickstart: Backend Phase 0 Foundation

This guide validates the backend-only Phase 0 foundation after implementation. It does not include Next.js or dashboard steps.

## Commands

Install backend dependencies after implementation updates:

```bash
composer install
```

Run migrations:

```bash
php artisan migrate
```

Seed foundation roles/permissions:

```bash
php artisan db:seed
```

Format code:

```bash
vendor/bin/pint
```

Run the backend test suite:

```bash
composer test
```

## Validation Scenarios

### Health

1. Start the backend service.
2. Request `GET /api/v1/health`.
3. Confirm `200` and the standard success envelope.

### Login

1. Ensure a staff user exists.
2. Request `POST /api/v1/auth/login` with valid credentials.
3. Confirm the response includes user details, roles, permissions, and token.
4. Request the same endpoint with invalid credentials.
5. Confirm a safe `401` error.

### Current User

1. Request `GET /api/v1/auth/me` without a token.
2. Confirm `401`.
3. Request it with a valid token.
4. Confirm current user data includes roles and permissions.

### Logout

1. Authenticate and get a token.
2. Request `POST /api/v1/auth/logout`.
3. Reuse the same token on a protected endpoint.
4. Confirm access is rejected.

### Permission Gate

1. Authenticate as a user with `foundation.access-sample`.
2. Request `GET /api/v1/foundation/protected-sample`.
3. Confirm `200`.
4. Authenticate as a user without the permission.
5. Request the same endpoint.
6. Confirm `403`.

### Audit

1. Perform the selected tracked action.
2. Confirm an `activity_log` row exists.
3. Confirm the audit properties do not contain passwords or tokens.

### Settings

1. Store a branding placeholder setting through the planned backend action/service.
2. Read it back.
3. Confirm the value matches.

### Queue, Cache, Storage, Realtime

1. Dispatch the foundation probe job.
2. Confirm it completes under the test queue configuration.
3. Write and read a cache value.
4. Write and read a probe file on the local disk.
5. Confirm broadcast/realtime config exists and is safe for the test environment.

## Scope Guard

Do not validate or implement dashboard login, Next.js pages, RTL layout, frontend hooks, UI permission gates, or browser UI in this phase.
