<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;

/**
 * Centralises the standard API envelope so every response shape is defined
 * in one place.
 *
 * Success envelope : { data, meta, message }
 * Error  envelope  : { error: { code, message, details } }
 */
final class ApiResponse
{
    /**
     * Return a standard success envelope.
     *
     * @param  array<string,mixed>  $meta
     */
    public static function success(
        mixed $data = null,
        string $message = '',
        array $meta = [],
        int $status = 200,
    ): JsonResponse {
        // Preserve explicit null (e.g. "no open shift session"). Only coerce
        // undefined-style emptiness when callers omit data entirely is already null.
        // Empty array stays []; empty object is not used as a null stand-in.
        return response()->json([
            'data' => $data,
            'meta' => empty($meta) ? (object) [] : $meta,
            'message' => $message,
        ], $status);
    }

    /**
     * Return a standard error envelope.
     *
     * @param  array<string,mixed>|object  $details
     */
    public static function error(
        string $code,
        string $message,
        array|object $details = [],
        int $status = 400,
    ): JsonResponse {
        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => empty((array) $details) ? (object) [] : $details,
            ],
        ], $status);
    }
}
