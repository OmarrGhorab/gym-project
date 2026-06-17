<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Auth\HandleSocialLogin;
use App\Actions\Auth\LoginStaffUser;
use App\Actions\Auth\LogoutStaffUser;
use App\Actions\Auth\RegisterUser;
use App\Actions\Auth\ResetUserPassword;
use App\Actions\Auth\SendPasswordResetOtp;
use App\Actions\Auth\VerifyPasswordResetOtp;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * US2 — Authenticate Staff Users
 *
 * Thin controller: validates via Form Requests, delegates logic to Actions,
 * returns shaped responses via UserResource or the ApiResponse envelope.
 * No business logic lives here.
 */
final class AuthController extends ApiController
{
    /**
     * Providers allowed by the social login endpoints.
     *
     * Only Google is enabled per product requirement.
     *
     * @var list<string>
     */
    private const ALLOWED_PROVIDERS = ['google'];

    /**
     * POST /api/v1/auth/register
     *
     * Validates the registration payload via RegisterRequest, creates the user
     * via RegisterUser, and returns a one-time plain-text Sanctum token.
     */
    public function register(RegisterRequest $request, RegisterUser $action): JsonResponse
    {
        $result = $action->handle(
            name: $request->validated('name'),
            email: $request->validated('email'),
            password: $request->validated('password'),
        );

        $userResource = (new UserResource($result['user']))->toArray($request);

        return $this->success(
            data: [
                'user' => $userResource,
                'token' => $result['token'],
            ],
            message: 'Registered',
        );
    }

    /**
     * POST /api/v1/auth/forgot-password
     *
     * Sends a one-time password (OTP) to the provided email address.
     * Always returns a success envelope to prevent account enumeration.
     */
    public function forgotPassword(ForgotPasswordRequest $request, SendPasswordResetOtp $action): JsonResponse
    {
        $action->handle($request->validated('email'));

        return $this->success(
            data: null,
            message: 'If the email exists, a password reset code has been sent.',
        );
    }

    /**
     * POST /api/v1/auth/verify-otp
     *
     * Verifies the OTP entered by the user and issues a short-lived reset
     * token that can be used to set a new password.
     */
    public function verifyOtp(VerifyOtpRequest $request, VerifyPasswordResetOtp $action): JsonResponse
    {
        $result = $action->handle(
            email: $request->validated('email'),
            otp: $request->validated('otp'),
        );

        if (! $result['valid']) {
            return $this->error(
                code: 'invalid_otp',
                message: 'The code is invalid or has expired.',
                status: 400,
            );
        }

        return $this->success(
            data: ['reset_token' => $result['token']],
            message: 'Code verified. You may now reset your password.',
        );
    }

    /**
     * POST /api/v1/auth/reset-password
     *
     * Resets the user's password using a valid reset token.
     */
    public function resetPassword(ResetPasswordRequest $request, ResetUserPassword $action): JsonResponse
    {
        $status = $action->handle(
            email: $request->validated('email'),
            token: $request->validated('token'),
            password: $request->validated('password'),
        );

        if ($status !== Password::PASSWORD_RESET) {
            return $this->error(
                code: 'password_reset_failed',
                message: 'The password reset token is invalid or expired.',
                status: 400,
            );
        }

        return $this->success(
            data: null,
            message: 'Password reset successfully.',
        );
    }

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
            remember: (bool) $request->validated('remember', false),
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
     * GET /api/v1/auth/{provider}/redirect
     *
     * Redirects the caller to the selected OAuth provider's authorization screen.
     * Only providers listed in ALLOWED_PROVIDERS are accepted.
     */
    public function socialRedirect(string $provider): RedirectResponse
    {
        $this->ensureAllowedProvider($provider);

        return Socialite::driver($provider)->stateless()->redirect();
    }

    /**
     * GET /api/v1/auth/{provider}/callback
     *
     * Receives the OAuth provider callback, resolves or creates the user via
     * HandleSocialLogin, and returns a Sanctum token in the standard envelope.
     */
    public function socialCallback(string $provider, HandleSocialLogin $action): JsonResponse
    {
        $this->ensureAllowedProvider($provider);

        $socialiteUser = Socialite::driver($provider)->stateless()->user();

        if (empty($socialiteUser->getEmail())) {
            throw ValidationException::withMessages([
                'email' => ['The social account did not provide an email address.'],
            ]);
        }

        $result = $action->handle($provider, $socialiteUser);

        $userResource = (new UserResource($result['user']))->toArray(request());

        return $this->success(
            data: [
                'user' => $userResource,
                'token' => $result['token'],
            ],
            message: 'Authenticated via '.ucfirst($provider),
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

    /**
     * Ensure the requested provider is supported by this application.
     */
    private function ensureAllowedProvider(string $provider): void
    {
        if (! in_array($provider, self::ALLOWED_PROVIDERS, true)) {
            throw new NotFoundHttpException('Unsupported social provider.');
        }
    }
}
