<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Responses\ApiResponse;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

/**
 * Base controller for all /api/v1 endpoints.
 *
 * Provides convenience access to ApiResponse and the authorization helpers.
 * Controllers must remain thin: validate via Form Requests, authorize via
 * Policies/middleware, delegate logic to Actions, return API Resources.
 */
abstract class ApiController extends Controller
{
    use AuthorizesRequests;

    /**
     * Return a standard success envelope response.
     *
     * @param  array<string,mixed>  $meta
     */
    protected function success(
        mixed $data = null,
        string $message = '',
        array $meta = [],
        int $status = 200,
    ): JsonResponse {
        return ApiResponse::success($data, $message, $meta, $status);
    }

    /**
     * Return a standard error envelope response.
     *
     * @param  array<string,mixed>|object  $details
     */
    protected function error(
        string $code,
        string $message,
        array|object $details = [],
        int $status = 400,
    ): JsonResponse {
        return ApiResponse::error($code, $message, $details, $status);
    }
}
