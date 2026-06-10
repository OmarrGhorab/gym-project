<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Auth\LoginStaffUser;
use App\Actions\Auth\LogoutStaffUser;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * US2 — Authenticate Staff Users
 *
 * Thin controller: validates via LoginRequest, delegates logic to Actions,
 * returns shaped responses via UserResource or the ApiResponse envelope.
 * No business logic lives here.
 */
final class AuthController extends ApiController
{
    /**
     * POST /api/v1/auth/login
     *
     * Validates credentials via LoginRequest, authenticates via
     * LoginStaffUser, and returns a one-time plain-text Sanctum token.
     */
    public function login(LoginRequest $request, LoginStaffUser $action): JsonResponse
    {
        $result = $action->handle(
            email: $request->validated('email'),
            password: $request->validated('password'),
        );

        $userResource = (new UserResource($result['user']))->toArray($request);

        return $this->success(
            data: [
                'user' => $userResource,
                'token' => $result['token'],
            ],
            message: 'Authenticated',
        );
    }

    /**
     * GET /api/v1/auth/me
     *
     * Returns the currently authenticated user's profile.
     * Route is protected by auth:sanctum middleware.
     */
    public function me(Request $request): JsonResponse
    {
        return (new UserResource($request->user()))
            ->withMessage('Current user')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * POST /api/v1/auth/logout
     *
     * Revokes the current token via LogoutStaffUser.
     * Route is protected by auth:sanctum middleware.
     */
    public function logout(Request $request, LogoutStaffUser $action): JsonResponse
    {
        $action->handle($request->user());

        return $this->success(
            data: null,
            message: 'Signed out',
        );
    }
}
