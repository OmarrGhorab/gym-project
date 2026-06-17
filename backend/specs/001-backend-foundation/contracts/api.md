# API Contract: Backend Phase 0 Foundation

Base path: `/api/v1`

## Response Shapes

### Success

```json
{
  "data": {},
  "meta": {},
  "message": "Human-readable message"
}
```

### Error

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## GET /health

**Auth**: Public

**Success 200**:

```json
{
  "data": {
    "status": "ok"
  },
  "meta": {},
  "message": "Service is healthy"
}
```

## POST /auth/register

**Auth**: Public

**Request**:

```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "password",
  "password_confirmation": "password"
}
```

**Success 200**:

```json
{
  "data": {
    "user": {
      "id": 1,
      "name": "Admin User",
      "email": "admin@example.com",
      "roles": ["Admin"],
      "permissions": ["foundation.access-sample"]
    }
  },
  "meta": {},
  "message": "Registered. Please check your email for a verification code."
}
```

Creates an unverified user and sends a 6-digit OTP to the provided email. The user must verify the OTP via `POST /auth/verify-email` before a token is issued.

**Errors**:

- `422 validation_failed`
- `429 too_many_requests`

## POST /auth/verify-email

**Auth**: Public

**Request**:

```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```

**Success 200**:

```json
{
  "data": {
    "user": {
      "id": 1,
      "name": "Admin User",
      "email": "admin@example.com",
      "roles": ["Admin"],
      "permissions": ["foundation.access-sample"]
    },
    "token": "plain-text-token-returned-once"
  },
  "meta": {},
  "message": "Email verified. You are now signed in."
}
```

Verifies the email verification OTP. On success, marks the email as verified and returns a Sanctum token.

**Errors**:

- `400 invalid_otp`
- `422 validation_failed`
- `429 too_many_requests`

## POST /auth/resend-verification

**Auth**: Public

**Request**:

```json
{
  "email": "admin@example.com"
}
```

**Success 200**:

```json
{
  "data": null,
  "meta": {},
  "message": "If the account exists and is unverified, a new code has been sent."
}
```

Resends the verification OTP for an unverified account. Response is identical for non-existent or already-verified emails to prevent enumeration.

**Errors**:

- `422 validation_failed`
- `429 too_many_requests`

## POST /auth/login

**Auth**: Public

**Request**:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

**Success 200**:

```json
{
  "data": {
    "user": {
      "id": 1,
      "name": "Admin User",
      "email": "admin@example.com",
      "roles": ["Admin"],
      "permissions": ["foundation.access-sample"]
    },
    "token": "plain-text-token-returned-once"
  },
  "meta": {},
  "message": "Authenticated"
}
```

**Errors**:

- `401 invalid_credentials`
- `403 email_not_verified`
- `422 validation_failed`
- `429 too_many_requests`

## GET /auth/me

**Auth**: Required

**Success 200**:

```json
{
  "data": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "roles": ["Admin"],
    "permissions": ["foundation.access-sample"]
  },
  "meta": {},
  "message": "Current user"
}
```

**Errors**:

- `401 unauthenticated`

## POST /auth/logout

**Auth**: Required

**Success 200**:

```json
{
  "data": null,
  "meta": {},
  "message": "Signed out"
}
```

**Errors**:

- `401 unauthenticated`

## GET /foundation/protected-sample

**Auth**: Required

**Permission**: `foundation.access-sample`

**Success 200**:

```json
{
  "data": {
    "allowed": true
  },
  "meta": {},
  "message": "Permission verified"
}
```

**Errors**:

- `401 unauthenticated`
- `403 forbidden`

## POST /auth/forgot-password

**Auth**: Public

**Request**:

```json
{
  "email": "admin@example.com"
}
```

**Success 200**:

```json
{
  "data": null,
  "meta": {},
  "message": "If the email exists, a password reset code has been sent."
}
```

Sends a 6-digit OTP to the user's email when the account exists. The response is identical for non-existent emails to prevent account enumeration.

**Errors**:

- `422 validation_failed`
- `429 too_many_requests`

## POST /auth/verify-otp

**Auth**: Public

**Request**:

```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```

**Success 200**:

```json
{
  "data": {
    "reset_token": "laravel-password-reset-token"
  },
  "meta": {},
  "message": "Code verified. You may now reset your password."
}
```

Verifies the OTP entered by the user. On success, returns a short-lived reset token that must be used with `POST /auth/reset-password`. The OTP is consumed after a successful verification.

**Errors**:

- `400 invalid_otp`
- `422 validation_failed`
- `429 too_many_requests`

## POST /auth/reset-password

**Auth**: Public

**Request**:

```json
{
  "email": "admin@example.com",
  "token": "laravel-password-reset-token",
  "password": "NewPassword123!",
  "password_confirmation": "NewPassword123!"
}
```

**Success 200**:

```json
{
  "data": null,
  "meta": {},
  "message": "Password reset successfully."
}
```

Resets the user's password using the reset token returned by `POST /auth/verify-otp`. The token is consumed after a successful reset.

**Errors**:

- `400 password_reset_failed`
- `422 validation_failed`
- `429 too_many_requests`

## Standard 422 Validation Error

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The given data was invalid.",
    "details": {
      "email": ["The email field is required."]
    }
  }
}
```

## Standard 404 Not Found Error

```json
{
  "error": {
    "code": "not_found",
    "message": "The requested resource was not found.",
    "details": {}
  }
}
```
