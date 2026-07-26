<?php

use Illuminate\Support\Facades\Route;

test('every non-public route in api v1 has auth:sanctum and a permission or role gate', function (): void {
    $routes = Route::getRoutes();
    $publicRoutes = [
        'api/v1/health',
        'api/v1/auth/login',
        'api/v1/auth/register',
        'api/v1/auth/verify-email',
        'api/v1/auth/resend-verification',
        'api/v1/auth/forgot-password',
        'api/v1/auth/verify-otp',
        'api/v1/auth/reset-password',
        'api/v1/auth/{provider}/redirect',
        'api/v1/auth/{provider}/callback',
    ];

    // Routes that are deliberately reachable without a session: access is granted by a
    // cryptographically signed, expiring URL minted by an already-authorised user.
    // (members.report.share is permission:members.view gated and hands out a 7-day
    // temporary signed link so a member can fetch their own report copy.)
    // These must still carry the 'signed' middleware — that is their gate.
    $signedUrlRoutes = [
        'api/v1/members/{member}/report/share/download',
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

        if (in_array($uri, $signedUrlRoutes, true)) {
            if (! in_array('signed', $middleware, true)) {
                $unprotectedRoutes[] = [
                    'uri' => $uri,
                    'methods' => $route->methods(),
                    'middleware' => $middleware,
                ];
            }

            continue;
        }

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

        // Every authorisation middleware the app registers counts as a gate:
        // Spatie's permission/role/role_or_permission aliases plus Laravel's
        // policy-backed 'can:' (used where the rule is per-record, e.g. an
        // employee may read only their own payslip).
        $gatePrefixes = ['permission:', 'role:', 'role_or_permission:', 'can:'];

        $hasGate = false;
        foreach ($middleware as $m) {
            foreach ($gatePrefixes as $prefix) {
                if (str_starts_with($m, $prefix)) {
                    $hasGate = true;

                    break 2;
                }
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
