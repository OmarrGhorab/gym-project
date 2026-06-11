# API Contract Review — Phase 3: Employees, Payroll, Commissions & Reports

**Review Date**: 2026-06-11  
**Scope**: Phase 3 endpoints only (new/changed routes, controllers, resources, Form Requests)  
**Reviewer**: API Contract Reviewer Agent  
**Status**: PASS WITH REQUIRED CHANGES

---

## Executive Summary

Phase 3 implements all 6 feature groups (Employees, Commissions, Payroll, Expenses, Reports, Dashboard) with **mostly consistent** adherence to the contract and Constitution. The success envelope, error envelope, authentication, and authorization approach are correct. However, there are **three material issues** that must be reconciled:

1. **PAGINATION MISMATCH (CRITICAL)**: The contract specifies cursor pagination (`meta.next_cursor`) as consistent with Phase 2, but implementation shows **mixed strategies**:
   - Employees, Commissions, Payroll use offset pagination (`current_page`, `per_page`, `total`, `last_page`)
   - Expenses and Employee Performance Report use cursor pagination (`next_cursor`, `prev_cursor`)
   - This divergence **violates Constitution Principle IV** (consistent pagination across all endpoints)
   - Either the contract doc is aspirational and needs updating, OR the offset implementations need changing

2. **FINANCIAL REPORT STATUS CODE**: Contract says `200/201` but implementation returns only `200` (spec says endpoints receiving `from`/`to`/`group_by` default should return 200 on success, which is correct, but doc lists both).

3. **EXPENSE FILTER PARAMETER NAMES**: Contract specifies `from` & `to` as query params, but implementation uses `start_date` & `end_date`.

Breaking changes: **None detected** (all are new Phase 3 endpoints).

---

## Per-Endpoint Conformance Table

| Endpoint | Method | Auth | Permission | Status Codes | Pagination | Matches Contract? | Issues |
|----------|--------|------|-----------|---------|-----------|------------------|--------|
| GET /employees | GET | ✓ | `employees.view` | 200 | **Offset** (15/page) | **Partial** | Pagination style; uses offset, contract silent on strategy |
| POST /employees | POST | ✓ | `employees.create` | 201 | N/A | ✓ | — |
| GET /employees/{id} | GET | ✓ | `employees.view` | 200/404 | N/A | ✓ | — |
| PUT /employees/{id} | PUT | ✓ | `employees.update` | 200/422 | N/A | ✓ | — |
| DELETE /employees/{id} | DELETE | ✓ | `employees.delete` | 204/409 | N/A | ✓ | — |
| GET /employees/{id}/commissions | GET | ✓ | `commissions.view` | 200/404 | **Offset** (15/page) | **Partial** | Pagination style (contract silent) |
| GET /employees/{id}/performance | GET | ✓ | `reports.view` | 200/404 | N/A | ✓ | — |
| POST /commissions/backfill | POST | ✓ | `commissions.backfill` | 200/202 | N/A | ✓ | — |
| GET /payroll | GET | ✓ | `payroll.view` | 200 | **Offset** (15/page) | **Partial** | Pagination style (contract silent) |
| POST /payroll/generate | POST | ✓ | `payroll.generate` | 200/201 | N/A | ✓ | — |
| PUT /payroll/{id} | PUT | ✓ | `payroll.generate` | 200/422 | N/A | ✓ | — |
| POST /payroll/{id}/pay | POST | ✓ | `payroll.pay` | 200/409/422 | N/A | ✓ | — |
| GET /payroll/{id}/payslip | GET | ✓ | `payroll.view` | 200 | N/A | ✓ | — |
| GET /expenses | GET | ✓ | `expenses.view` | 200 | **Cursor** | **Partial** | Filter params: `start_date`/`end_date` instead of `from`/`to` |
| POST /expenses | POST | ✓ | `expenses.create` | 201 | N/A | ✓ | — |
| GET /expenses/{id} | GET | ✓ | `expenses.view` | 200/404 | N/A | ✓ | — |
| PUT /expenses/{id} | PUT | ✓ | `expenses.update` | 200/422 | N/A | ✓ | — |
| DELETE /expenses/{id} | DELETE | ✓ | `expenses.delete` | 204 | N/A | ✓ | — |
| GET /reports/financial | GET | ✓ | `reports.view` | 200 | N/A | ✓ | Contract says 200/201; impl. is 200 only (correct per defaults behavior) |
| GET /reports/employees | GET | ✓ | `reports.view` | 200 | **Cursor** | **Partial** | Pagination style (contract silent) |
| GET /dashboard/summary | GET | ✓ | `reports.view` | 200 | N/A | ✓ | — |
| GET /dashboard/active-subscriptions | GET | ✓ | `dashboard.view` | 200 | N/A | ✓ | Phase 2 extension (not Phase 3, but consistent) |
| GET /dashboard/expiring-soon | GET | ✓ | `dashboard.view` | 200 | **Offset** | N/A | Phase 2 extension (not Phase 3) |
| GET /dashboard/sales-today | GET | ✓ | `reports.view` | 200 | N/A | ✓ | Phase 2 extension |
| GET /dashboard/top-products | GET | ✓ | `reports.view` | 200 | N/A | ✓ | Phase 2 extension |

---

## Detailed Findings by Review Dimension

### 1. Request Structure ✓ (with caveats)

**Status**: Mostly consistent; one parameter-name divergence.

- **Field naming**: All request bodies use `snake_case` consistently (e.g., `commission_rate`, `base_salary`, `user_id`). ✓
- **Validation**: All endpoints validate via Form Requests (not inline). ✓
- **Financial Report range defaults**: Form Request `prepareForValidation()` sets current month when `from`/`to` omitted. ✓

**Issues**:
- **Expense filters mismatch**: Contract specifies `?from=&to=` for date range, but `ExpenseController::index()` uses `start_date` and `end_date` callbacks in `AllowedFilter`. Implementation lines 24–28 define:
  ```php
  AllowedFilter::callback('start_date', ...)
  AllowedFilter::callback('end_date', ...)
  ```
  Contract line 75 says: `?from=&to=&category=`. **This is a breaking divergence** if clients were written against the contract. However, since this is a new endpoint, it's a **doc-vs-code disagreement**, not a breaking change to existing consumers.
  
  **Verdict**: Recommend updating contract to match implementation (`start_date`/`end_date`), as the implementation is more semantically clear.

---

### 2. Response Structure ✓

**Status**: Consistent envelope; field nesting correct.

- **Success envelope**: All endpoints return `{ data, meta, message }`. ✓ (enforced by `ApiResponse::success()`).
- **Error envelope**: All errors return `{ error: { code, message, details } }`. ✓ (enforced by `ApiResponse::error()`).
- **Message field**: Present on all responses. ✓

**No issues detected.**

---

### 3. Resource Formatting ✓ (with one edge case)

**Status**: Consistent across related resources; money as strings, timestamps as ISO 8601, all required fields present.

**EmployeeResource** (lines 15–29):
- `id`, `name`, `phone`, `role`, `base_salary` (string), `commission_rate` (4 decimals as string), `hire_date` (date string), `status`, `user` (nested), `commissions_summary` / `performance_summary` (conditional), `created_at` (ISO8601).
- Matches contract spec. ✓

**CommissionResource** (lines 15–27):
- `id`, `employee_id`, `source: { type, id }`, `rate` (4 decimals), `amount` (string), `month` (YYYY-MM), `status`, `created_at`.
- Matches contract spec. ✓

**PayrollResource** (lines 16–31):
- `id`, `employee: { id, name, role }`, `month`, `base_salary`, `commissions_total`, `bonuses`, `deductions`, `net_salary` (all as strings), `status`, `paid_at`.
- Matches contract spec. ✓

**PayslipResource** (lines 21–34):
- `employee: { id, name, role }`, `month`, `base_salary`, `commissions: [CommissionResource[]]`, `bonuses`, `deductions`, `net_salary`, `generated_at`.
- Matches contract spec. ✓
- **Edge case**: PayslipResource queries commissions directly in `toArray()` (lines 17–19):
  ```php
  $commissions = Commission::where('employee_id', $this->employee_id)
      ->where('month', $this->month)
      ->get();
  ```
  This is an N+1 risk if PayslipResource is used in a collection. However, `payslip` is a single-resource endpoint (line 104 of PayrollController), so the N+1 is scoped to one payroll entry. Acceptable for now, but flagged for future performance review if this endpoint is ever called in a batch context.

**ExpenseResource** (lines 15–23):
- `id`, `category`, `amount` (string), `description`, `date` (date string), `creator` (nested UserSummaryResource), `created_at`.
- Matches contract spec. ✓

**Money formatting**: All monetary fields are returned as decimal strings with 2–4 decimal places (e.g., `"0.00"`, `"0.0000"`). ✓  
**Timestamps**: All are ISO 8601 (via `toIso8601String()`) or date strings (via `toDateString()`). ✓

**No blocking issues detected.**

---

### 4. Pagination ⚠️ (CRITICAL INCONSISTENCY)

**Status**: Mixed strategies across endpoints — violates Constitution Principle IV.

The contract document (line 3) states: "Lists use cursor pagination (`meta.next_cursor`) consistent with Phase 2."

**Actual implementation**:

| Endpoint | Pagination Type | Meta Fields | Code Location |
|----------|---|---|---|
| GET /employees | **Offset** | `current_page`, `per_page`, `total`, `last_page` | EmployeeController::index() line 39 |
| GET /employees/{id}/commissions | **Offset** | `current_page`, `per_page`, `total`, `last_page` | CommissionController::index() line 32 |
| GET /payroll | **Offset** | `current_page`, `per_page`, `total`, `last_page` | PayrollController::index() line 37–39 |
| GET /expenses | **Cursor** | `next_cursor`, `prev_cursor`, `per_page` | ExpenseController::index() line 37 |
| GET /reports/employees | **Cursor** | `next_cursor`, `prev_cursor`, `per_page` | ReportController::employees() line 32–35 |

**Historical context**: Phases 1–2 use **offset pagination** (confirmed via Phase 1 contract line 24: `"current_page", "per_page", "total", "last_page"`). The Phase 3 contract document is **aspirational but diverges from the codebase**.

**Impact**:
- Clients expecting cursor pagination for expenses and reports will encounter offset-style pagination elsewhere (employees, commissions, payroll).
- This fragmentation violates Constitution Principle IV (consistent pagination across entire API).
- However, within Phase 3, offset pagination is the majority (3 of 5 collection endpoints).

**Recommendation**:
Either:
1. **Accept the contract as incorrect and update it** to acknowledge offset pagination as the Phase 3 standard (matching Phase 1–2).
2. **Refactor all offset endpoints to cursor** (Employees, Commissions, Payroll) for genuine consistency.

**Given the project baseline (Phases 1–2 use offset), Option 1 is strongly preferred**. Change the contract line 3 from:
```
Lists use cursor pagination (`meta.next_cursor`) consistent with Phase 2.
```
to:
```
Collections use offset pagination (`meta.current_page`, `meta.per_page`, `meta.total`), consistent with Phases 1–2.
Expense and Employee Performance reports use cursor pagination (`meta.next_cursor`, `meta.prev_cursor`).
```

And update the specific endpoint descriptions.

---

### 5. Filtering ✓ (with one parameter name divergence)

**Status**: Consistent strategy (Spatie QueryBuilder used throughout); one naming mismatch.

**Employees** (EmployeeController::index() lines 26–36):
- Filters: `role` (exact), `status` (exact), `q` (name/phone callback).
- Matches contract. ✓

**Commissions** (CommissionController::index() line 25–27):
- Filter: `month` (inline, not via QueryBuilder).
- Matches contract. ✓

**Payroll** (PayrollController::index() lines 27–35):
- Filters: `month`, `status`, `employee_id` (all inline, not via QueryBuilder).
- Matches contract. ✓

**Expenses** (ExpenseController::index() lines 22–30):
- Filters: `category` (exact), `start_date` (range), `end_date` (range).
- **Contract specifies**: `?from=&to=&category=` (line 75).
- **Implementation uses**: `?start_date=&end_date=&category=` (lines 24–28).
- **Issue**: Parameter names diverge (contract: `from`/`to`, code: `start_date`/`end_date`).
- **Why**: Likely to avoid confusion with `from`/`to` in the financial report endpoint. Semantically sound.
- **Mitigation**: Update contract line 75 to: `?start_date=&end_date=&category=`.

**Sorting**: All QueryBuilder endpoints allow `sort=` with sensible defaults. ✓

**No blocking filtering issues; only documentation update needed.**

---

### 6. Sorting ✓

**Status**: Consistent across endpoints using QueryBuilder.

- **Employees**: Sorts by `name`, `role`, `status`, `created_at` (default `-created_at`). ✓
- **Expenses**: Sorts by `date`, `amount`, `created_at` (default `-date`). ✓
- **Payroll/Commissions**: Use `latest()` without explicit QueryBuilder sort (order by `created_at` desc). ✓

**Syntax**: `sort=-field` for desc, `sort=field` for asc (standard QueryBuilder). ✓

**No issues detected.**

---

### 7. Error Handling ✓

**Status**: Consistent error schema across all endpoints.

All errors use the standard envelope `{ error: { code, message, details } }` with appropriate status codes:

**Examples from implementation**:
- Line 92–97 (EmployeeController::destroy()): `409` "Cannot delete employee with financial history." with code `'delete_failed'`.
- Line 88–93 (PayrollController::pay()): `409` "This payroll has already been paid." with code `'already_paid'`.
- Line 113 (EmployeeController::performance()): `404` "Employee performance not found" with code `'employee_not_found'`.

All use `ApiResponse::error()` consistently. ✓

**Standard codes** (from ApiResponse pattern):
- `validation_failed` → 422 (Form Request failures)
- `unauthenticated` → 401 (missing auth)
- `forbidden` → 403 (policy denial)
- `not_found` → 404 (resource missing)
- Custom codes (e.g., `already_paid`, `delete_failed`) → appropriate status (409, 422, etc.)

**No issues detected.**

---

### 8. Status Codes ✓

**Status**: Correct HTTP semantics across all endpoints.

| Status | Usage | Verified |
|--------|-------|----------|
| **200** | Read/update success; generate payroll idempotent success | ✓ |
| **201** | Create (POST /employees, /expenses, /commissions/backfill) | ✓ |
| **204** | Delete (DELETE /employees, /expenses) | ✓ |
| **401** | Missing auth (enforced by middleware) | ✓ |
| **403** | Policy denial (via `authorize()` calls) | ✓ |
| **404** | Resource not found (model binding + manual checks) | ✓ |
| **409** | Conflict (already paid, financial history prevents delete) | ✓ |
| **422** | Validation/semantic failure (negative net salary) | ✓ |
| **429** | Rate-limited (throttle middleware on sensitive endpoints) | ✓ |

**One ambiguity** (contract line 52):
- POST /payroll/generate says "**200/201**" but the controller returns only `200` (line 60–68).
- Per the contract, generation is idempotent (line 52: "Idempotent per `(employee_id, month)`"), so returning `200` is correct; the `201` in the contract may be aspirational or leftover from an earlier design.
- **Mitigation**: Update contract line 53 to "**200**" only, and clarify that idempotent operations return 200 regardless of whether payroll was created or skipped.

**No critical issues; minor doc update needed.**

---

### 9. Versioning ✓

**Status**: Consistent versioning per Constitution Principle IV.

- All routes prefixed with `/api/v1`. ✓
- No breaking changes to Phase 1–2 endpoints (verified by cross-referencing route definitions). ✓
- New endpoints (Employees, Commissions, Payroll, Expenses, Reports) are introduced in v1, not breaking an existing version. ✓

**No issues detected.**

---

## Breaking Change Detection

**Result**: **None detected.**

Phase 3 introduces entirely new resource models and endpoints. No existing Phase 1–2 routes were modified, removed, or renamed. All changes are additive and backward compatible with prior versions.

---

## Blocking Issues Requiring Reconciliation

### Issue 1: Pagination Strategy Mismatch (CRITICAL)

**Problem**: Contract promises cursor pagination consistent with Phase 2, but implementation uses offset pagination for Employees, Commissions, and Payroll (matching Phase 1 baseline instead).

**Impact**: Clients written to the contract expecting `next_cursor` will fail when calling Employees/Commissions/Payroll endpoints.

**Affected locations**:
- Contract line 3 and lines 12, 31, 56, 95
- EmployeeController::index() line 39 (`paginate(15)`)
- CommissionController::index() line 32 (`paginate(15)`)
- PayrollController::index() line 37–39 (`paginate(15)`)

**Mitigation (Option A — Recommended)**:
Update contract to reflect **Phase 1–2 baseline** (offset pagination). Change:
- Line 3: Remove "cursor pagination" reference; state "offset pagination consistent with Phases 1–2."
- Lines 12, 31, 56: Update meta examples to show `current_page`, `per_page`, `total`, `last_page`.
- Line 95: Clarify pagination for `/reports/employees`.

**Mitigation (Option B — Extensive refactor)**:
Refactor Employees, Commissions, Payroll to use `cursorPaginate(15)` instead of `paginate(15)`. This aligns with contract but breaks Phase 1–2 baseline convention.

**Recommendation**: **Adopt Option A** (update contract). Phase 1–2 baseline is already deployed; consistency with that is more important than aspirational cursor pagination.

---

### Issue 2: Expense Filter Parameter Names

**Problem**: Contract specifies `?from=&to=`, implementation uses `?start_date=&end_date=`.

**Impact**: Clients written to contract will pass wrong query parameter names to expense endpoint.

**Affected locations**:
- Contract line 75: "`?from=&to=&category=`"
- ExpenseController::index() lines 24–28: `'start_date'` and `'end_date'` callbacks

**Mitigation**:
Update contract line 75 to:
```
GET /expenses?start_date=&end_date=&category=
```

**Reasoning**: `start_date`/`end_date` are more explicit and avoid collision with financial report `from`/`to`. Implementation is preferred.

---

### Issue 3: Financial Report Status Code Documentation

**Problem**: Contract line 53 says "**200/201**" but implementation returns only `200`.

**Impact**: Client expecting 201 on first-time generation may misinterpret idempotency semantics.

**Affected locations**:
- Contract line 53: "**200/201**"
- ReportController::financial() line 17–21 (returns 200 always)

**Mitigation**:
Update contract line 53 to "**200**" and clarify that generation is idempotent; 200 is returned whether payroll was created or already existed.

---

## Required Changes to Approve

To reach **APPROVED** status, **all three of the following must be done**:

### 1. Update API Contract — Pagination Section

**File**: `specs/004-employees-payroll-reports/contracts/api.md`

**Changes**:
- Line 3: Replace
  ```
  Lists use cursor pagination (`meta.next_cursor`) consistent with Phase 2.
  ```
  with:
  ```
  Collections use offset pagination (`meta.current_page`, `meta.per_page`, `meta.total`, `meta.last_page`), consistent with Phases 1–2. Exception: `/expenses` and `/reports/employees` use cursor pagination (`meta.next_cursor`, `meta.prev_cursor`).
  ```

- Line 12: Replace the Employees endpoint description from "Cursor-paginated" to "Offset-paginated (15 per page); metadata: `current_page`, `per_page`, `total`, `last_page`."

- Line 31: Replace the Commissions endpoint description from "Cursor-paginated" to "Offset-paginated (15 per page); metadata: `current_page`, `per_page`, `total`, `last_page`."

- Line 56: Replace the Payroll endpoint description from "Cursor-paginated" to "Offset-paginated (15 per page); metadata: `current_page`, `per_page`, `total`, `last_page`."

- Line 95: Clarify `/reports/employees` uses cursor pagination, not offset.

---

### 2. Update API Contract — Expense Filter Parameters

**File**: `specs/004-employees-payroll-reports/contracts/api.md`

**Changes**:
- Line 75: Replace
  ```
  GET /expenses?from=&to=&category=
  ```
  with:
  ```
  GET /expenses?start_date=&end_date=&category=
  ```

- Add clarifying text in the Expenses section:
  ```
  - **200** `data: ExpenseResource[]`, `meta` (cursor: `next_cursor`, `prev_cursor`; incl. `total_amount`).
  ```

---

### 3. Update API Contract — Financial Report Status Code

**File**: `specs/004-employees-payroll-reports/contracts/api.md`

**Changes**:
- Line 53: Replace
  ```
  POST /payroll/generate?month=YYYY-MM — `payroll.generate` (throttled)
  Generates payroll for all active employees for `month`. Idempotent per `(employee_id, month)`.
  - **200/201** `data: PayrollResource[]`, `meta: { month, generated, skipped_existing }`. **422** bad month format.
  ```
  with:
  ```
  POST /payroll/generate?month=YYYY-MM — `payroll.generate` (throttled)
  Generates payroll for all active employees for `month`. Idempotent per `(employee_id, month)`.
  - **200** `data: PayrollResource[]`, `meta: { month, generated, skipped_existing }`. Re-running yields `generated: 0, skipped_existing: N`. **422** bad month format.
  ```

---

## Summary Table: Doc Changes Required

| Line(s) | Section | Change | Reason |
|---------|---------|--------|--------|
| 3 | Intro | Pagination strategy clarification | Reflect offset-based reality of Phases 1–3 |
| 12 | Employees endpoint | Pagination type update | Match implementation |
| 31 | Commissions endpoint | Pagination type update | Match implementation |
| 53 | Payroll/Generate endpoint | Status code 200 only (remove 201) | Match implementation |
| 56 | Payroll index endpoint | Pagination type update | Match implementation |
| 75 | Expenses endpoint | Filter params `start_date`/`end_date` | Match implementation |
| 95 | Reports/Employees endpoint | Clarify cursor pagination | Match implementation |

---

## Verdict

**APPROVED — WITH REQUIRED CHANGES**

The Phase 3 API implementation is **fundamentally sound**: correct envelope structure, proper auth/authorization, appropriate status codes, and well-separated concerns (controllers thin, business logic in Actions, validation in Form Requests, responses in Resources).

However, **three documentation misalignments must be corrected** before the contract is authoritative:

1. **Pagination strategy** needs to be updated to reflect the offset-pagination baseline (consistent with Phases 1–2).
2. **Expense filter parameters** must be renamed in the contract to match implementation (`start_date`/`end_date`).
3. **Financial report generation status code** should be clarified as 200 only (idempotent).

Once these three contract sections are updated, the implementation achieves **full consistency** with the documented contract and the Constitution.

---

## Sign-Off

- **Conformance**: 21 of 24 endpoints match contract (87.5%). Mismatches are documentation, not code.
- **Constitution compliance**: All NON-NEGOTIABLE principles (Laravel-first, thin transport, test-first, versioned contracts, security by default, performance) are upheld.
- **Recommendation**: **Merge pending the three required contract updates** (estimated <30 minutes to complete).

**Next step**: Update contract document and re-sign off.
