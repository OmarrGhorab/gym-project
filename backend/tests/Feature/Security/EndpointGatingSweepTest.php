<?php

use Illuminate\Support\Facades\Route;

test('every non-public route in api v1 has auth:sanctum and a permission or role gate', function (): void {
    $routes = Route::getRoutes();
    $publicRoutes = [
        'api/v1/health',
        'api/v1/auth/login',
        'api/v1/auth/register',
        'api/v1/auth/forgot-password',
        'api/v1/auth/verify-otp',
        'api/v1/auth/reset-password',
        'api/v1/auth/{provider}/redirect',
        'api/v1/auth/{provider}/callback',
    ];

    $unprotectedRoutes = [];

    foreach ($routes as $route) {
        $uri = $route->uri();

        // Only check api/v1 routes
        if (! str_starts_with($uri, 'api/v1')) {
            continue;
        }

        // Skip public routes
        if (in_array($uri, $publicRoutes, true)) {
            continue;
        }

        $middleware = $route->gatherMiddleware();

        $hasAuth = in_array('auth:sanctum', $middleware, true);

        // These require authentication but no specific permission
        $authOnlyRoutes = [
            'api/v1/auth/me',
            'api/v1/auth/logout',
        ];

        if (in_array($uri, $authOnlyRoutes, true)) {
            if (! $hasAuth) {
                $unprotectedRoutes[] = [
                    'uri' => $uri,
                    'methods' => $route->methods(),
                    'middleware' => $middleware,
                ];
            }

            continue;
        }

        $hasGate = false;
        foreach ($middleware as $m) {
            if (str_starts_with($m, 'permission:') || str_starts_with($m, 'role:') || str_starts_with($m, 'can:')) {
                $hasGate = true;
                break;
            }
        }

        if (! $hasAuth || ! $hasGate) {
            $unprotectedRoutes[] = [
                'uri' => $uri,
                'methods' => $route->methods(),
                'middleware' => $middleware,
            ];
        }
    }

    expect($unprotectedRoutes)->toBeEmpty(
        'The following routes are missing auth:sanctum or permission/role gates: '.json_encode($unprotectedRoutes, JSON_PRETTY_PRINT)
    );
});
