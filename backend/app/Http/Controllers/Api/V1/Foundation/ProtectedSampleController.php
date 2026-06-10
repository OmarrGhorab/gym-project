<?php

namespace App\Http\Controllers\Api\V1\Foundation;

use App\Actions\Foundation\RecordFoundationActivity;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * US3 — Enforce Role-Based Access: sample protected capability
 * US4 — Record Administrative Activity: audit log on access
 *
 * Demonstrates that Spatie permission middleware is correctly wired.
 * The route requires auth:sanctum + permission:foundation.access-sample.
 * No hand-rolled permission checks here — enforcement is in the route
 * definition via middleware, as required by the Constitution.
 *
 * Each successful access is recorded in the audit log via
 * RecordFoundationActivity (US4 integration).
 */
final class ProtectedSampleController extends ApiController
{
    /**
     * GET /api/v1/foundation/protected-sample
     *
     * Returns a success envelope confirming the caller has permission.
     * Records an audit event via RecordFoundationActivity.
     */
    public function index(Request $request, RecordFoundationActivity $auditAction): JsonResponse
    {
        $auditAction->handle(
            causer: $request->user(),
            event: 'foundation.sample-accessed',
            description: 'Staff user accessed the foundation protected sample endpoint.',
        );

        return ApiResponse::success(
            data: ['allowed' => true],
            message: 'Permission verified',
        );
    }
}
