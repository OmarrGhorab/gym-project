<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * US1 — Verify Platform Availability
 *
 * Public endpoint confirming the backend is online and returning the
 * standard success envelope. No auth required.
 */
final class HealthController extends ApiController
{
    /**
     * GET /api/v1/health
     *
     * Returns 200 with the standard success envelope.
     * No business logic — health is a static status signal.
     */
    public function index(): JsonResponse
    {
        return ApiResponse::success(
            data: ['status' => 'ok'],
            message: 'Service is healthy',
        );
    }
}
