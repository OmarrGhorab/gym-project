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
