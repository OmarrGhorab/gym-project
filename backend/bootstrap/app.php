<?php

use App\Exceptions\InvalidCredentialsException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Exceptions\InvalidStateException;
use League\OAuth1\Client\Credentials\CredentialsException;
use Spatie\Permission\Exceptions\UnauthorizedException as SpatieUnauthorizedException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Register Spatie Permission middleware aliases so routes can use
        // ->middleware('permission:some.permission') and 'role:...' shortcuts.
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Ensure all API exceptions render as consistent JSON envelopes.
        // The stable error shape is: { error: { code, message, details } }

        // InvalidCredentialsException must be registered before the generic
        // AuthenticationException handler — Laravel matches on exact type first
        // but to be safe we register the more specific type first.
        $exceptions->render(function (InvalidCredentialsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'invalid_credentials',
                        'message' => 'The provided credentials are incorrect.',
                        'details' => (object) [],
                    ],
                ], 401);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'unauthenticated',
                        'message' => 'Authentication required.',
                        'details' => (object) [],
                    ],
                ], 401);
            }
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'forbidden',
                        'message' => 'You do not have permission to perform this action.',
                        'details' => (object) [],
                    ],
                ], 403);
            }
        });

        // Spatie Permission middleware throws UnauthorizedException (HttpException 403)
        // rather than Laravel's AuthorizationException — handle it explicitly.
        $exceptions->render(function (SpatieUnauthorizedException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'forbidden',
                        'message' => 'You do not have permission to perform this action.',
                        'details' => (object) [],
                    ],
                ], 403);
            }
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'forbidden',
                        'message' => 'You do not have permission to perform this action.',
                        'details' => (object) [],
                    ],
                ], 403);
            }
        });

        $exceptions->render(function (InvalidSignatureException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'forbidden',
                        'message' => 'Invalid or expired URL.',
                        'details' => (object) [],
                    ],
                ], 403);
            }
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'not_found',
                        'message' => 'The requested resource was not found.',
                        'details' => (object) [],
                    ],
                ], 404);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'not_found',
                        'message' => 'The requested resource was not found.',
                        'details' => (object) [],
                    ],
                ], 404);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'validation_failed',
                        'message' => 'The given data was invalid.',
                        'details' => $e->errors(),
                    ],
                ], 422);
            }
        });

        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'too_many_requests',
                        'message' => 'Too many requests. Please slow down.',
                        'details' => (object) [],
                    ],
                ], 429);
            }
        });

        // Socialite / OAuth failures: invalid state, cancelled consent, or provider errors.
        $exceptions->render(function (InvalidStateException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'social_login_failed',
                        'message' => 'Invalid or expired OAuth state. Please try again.',
                        'details' => (object) [],
                    ],
                ], 400);
            }
        });

        $exceptions->render(function (CredentialsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'error' => [
                        'code' => 'social_login_failed',
                        'message' => 'OAuth provider rejected the request. Please try again.',
                        'details' => (object) [],
                    ],
                ], 400);
            }
        });

        // Catch-all: never leak internals in production.
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $message = app()->hasDebugModeEnabled()
                    ? $e->getMessage()
                    : 'An unexpected server error occurred.';

                return response()->json([
                    'error' => [
                        'code' => 'server_error',
                        'message' => $message,
                        'details' => (object) [],
                    ],
                ], 500);
            }
        });
    })->create();
