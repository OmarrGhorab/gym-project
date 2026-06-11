<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Roles\SyncUserRoles;
use App\Http\Requests\Roles\SyncUserRolesRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;

final class UserRoleController extends ApiController
{
    public function store(SyncUserRolesRequest $request, User $user, SyncUserRoles $action): JsonResponse
    {
        // Validation and authorization are handled in SyncUserRolesRequest
        $updatedUser = $action->handle($user, $request->validated());

        return (new UserResource($updatedUser))
            ->withMessage('User roles synchronized successfully')
            ->response();
    }
}
