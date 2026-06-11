---
name: api-conventions
description: Documented API contract conventions and baseline for Gym Platform API
metadata:
  type: reference
---

## Phase 1–3 API Baseline Conventions

This documents the canonical API conventions enforced across all Gym Platform phases. Use this to audit future endpoints and ensure consistency.

### Response Envelope (Canonical — NON-NEGOTIABLE)

**Success**: `{ data, meta, message }`
- `data`: resource(s) or empty object `{}`
- `meta`: pagination/aggregate metadata (object)
- `message`: human-readable operation summary (string)

**Error**: `{ error: { code, message, details } }`
- `code`: stable, machine-readable error code (string)
- `message`: human-readable error message (string)
- `details`: validation errors or contextual info (object)

**Reference**: `/app/Http/Responses/ApiResponse.php` (lines 14–53).

---

### Pagination Strategy (SETTLED — Offset-based)

**Standard**: Offset pagination via Laravel's native `paginate(15)`.

**Metadata fields**:
```json
{
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 120,
    "last_page": 8
  }
}
```

**Exceptions** (use cursor pagination only if explicitly required):
- `/expenses` (Phase 3): cursor pagination with `next_cursor`, `prev_cursor`
- `/reports/employees` (Phase 3): cursor pagination with `next_cursor`, `prev_cursor`

**Historical note**: Phase 3 contract initially stated "cursor pagination consistent with Phase 2," but Phase 2 uses offset. Phase 3 reconciliation updated the contract (as of 2026-06-11) to recognize offset as the phase baseline.

**Related memory**: [[pagination-vs-cursor-mismatch]]

---

### HTTP Status Codes (Canonical)

| Code | Condition | Usage |
|------|-----------|-------|
| **200** | Read/update success; idempotent operations | Standard success |
| **201** | Resource created | POST endpoints that create (but NOT idempotent generate/backfill) |
| **202** | Accepted (async processing) | Rare; async job endpoints |
| **204** | Delete success; no response body | DELETE endpoints |
| **400** | Bad request (general client error) | Rare; usually 422 for validation |
| **401** | Unauthenticated | Missing auth token; enforced by middleware |
| **403** | Forbidden (authorization denied) | Policy/Gate failure |
| **404** | Resource not found | Binding failure or explicit not-found check |
| **409** | Conflict (business rule violation) | Already paid, cannot delete with dependents, etc. |
| **422** | Unprocessable entity (validation failure) | Form Request validation failure; invalid state transitions |
| **429** | Too many requests | Rate limit exceeded |
| **5xx** | Server error | Unexpected exceptions; log + alert |

**Key distinction**:
- 422 = validation/semantic business rule broken (client's responsibility to fix)
- 409 = state conflict (e.g., already paid); may require admin intervention
- Use correct code; a 200 with an error body is a contract violation.

---

### Authentication & Authorization (Non-Negotiable)

**Pattern**: Every endpoint `auth:sanctum` + `permission:X` middleware.

**Architecture**: 
- Controllers call `$this->authorize('verb', Model::class)` OR Form Request's `authorize()` method
- Policies define the permission check logic
- Never hand-roll permission checks in controllers

**Key enforcement**:
- Authorization occurs BEFORE `findOrFail()` to prevent existence probing (security gate)
- See [[authorize-before-query]] for correct pattern

---

### Resource Formatting Conventions

**Money**: Always decimal strings with 2 places.
```php
'amount' => number_format((float) $amount, 2, '.', '')  // "123.45"
'rate' => number_format((float) $rate, 4, '.', '')       // "0.0500" (for commission rates)
```

**Timestamps**: ISO 8601 via `toIso8601String()`.
```php
'created_at' => $model->created_at?->toIso8601String()  // "2026-06-11T10:30:00Z"
```

**Dates**: YYYY-MM-DD via `toDateString()`.
```php
'date' => $model->date?->toDateString()  // "2026-06-11"
'month' => $model->month  // "2026-06" (YYYY-MM format, often a string column)
```

**Nested relationships**: Use dedicated Resources or array tuples.
```php
'user' => new UserSummaryResource($this->whenLoaded('user')),
'source' => ['type' => $this->source_type, 'id' => $this->source_id],
```

---

### Filtering Conventions

**Strategy**: Use Spatie QueryBuilder (`AllowedFilter::exact()`, `::callback()`) for declarative, safe filtering.

**Naming**: Filter parameter names match the business concept (e.g., `status`, `role`, `category`). Use consistent names across similar resources.

**Operators**:
- Exact match: `AllowedFilter::exact('status')` → `?status=active`
- Range: `AllowedFilter::callback('start_date', ...)` → `?start_date=2026-01-01`
- Full-text: `AllowedFilter::callback('q', ...)` → `?q=search+term`

**Avoid**: Unvalidated raw query input; always wrap in QueryBuilder helpers.

---

### Sorting Conventions

**Syntax**: `sort=field` (ascending) or `sort=-field` (descending).

**Implementation**: Use Spatie QueryBuilder `allowedSorts()`:
```php
->allowedSorts('name', 'created_at', 'status')
->defaultSort('-created_at')
```

**Validation**: Explicitly list sortable fields; never expose all columns to sort.

---

### Throttling/Rate Limiting

**Standard throttle**: `throttle:api` (standard API rate limit, typically 60 requests/minute per user).

**Sensitive throttle**: `throttle:sensitive` (reduced limit, typically 10 requests/minute per user) for:
- Auth endpoints (login, password reset)
- Payment/financial operations (payroll generation, commission backfill)
- Administrative operations (backfill, generate)

**Reference**: Middleware defined in `app/Http/Middleware` and configured in `config/api.php` or kernel.

---

### Form Request Validation Patterns

**Canonical pattern**:
```php
public function authorize(): bool {
    return $this->user()->can('create', Model::class);
}

protected function prepareForValidation(): void {
    // Apply defaults, massage input (e.g., parse dates)
    $this->merge([...]);
}

public function rules(): array {
    return [...];
}
```

**Never** hand-roll validation in controllers. All validation lives in Form Requests.

**Defaults**: Use `prepareForValidation()` to set sensible defaults (e.g., current month for financial reports).

---

### N+1 Prevention

**Rule**: Eager-load all relationships rendered by Resources.

**Pattern**:
```php
$models->load('user', 'commissions');  // After fetch
$models->with('user', 'commissions');  // In builder
```

**In Resources**: Use `$this->whenLoaded('relation')` to render only if loaded.

**Edge case**: PayslipResource queries commissions inline (N+1 if used in collection); acceptable only for single-resource endpoints.

---

### Pagination Default

**Standard page size**: 15 items per page (offset) or 15 items per cursor request.

**Rationale**: Balance between payload size and API round-trips.

---

### Versioning

**Strategy**: URI-path versioning (`/api/v1/...`).

**Policy**: One stable version at a time. Breaking changes → new version.

**Non-negotiable**: Never break an existing stable version in place.

---

## Related Memories

- [[pagination-vs-cursor-mismatch]] — Phase 3 pagination audit findings
- [[authorize-before-query]] — Security pattern for authorization gates
- [[money-formatting-strings]] — Why monetary amounts are always strings, never floats
- [[form-request-defaults]] — Handling optional query parameters with sensible defaults

---

## When to Reference This

- **New endpoint design**: Use this as the baseline for all request/response shapes
- **Code review**: Compare endpoints against these conventions; flag deviations
- **API contract disputes**: Point to this doc + Constitution Principle IV as the authority
- **Cross-phase audit**: Verify new phases follow these baseline conventions
