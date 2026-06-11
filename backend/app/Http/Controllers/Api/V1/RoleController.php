<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Roles\DeleteRole;
use App\Actions\Roles\StoreRole;
use App\Actions\Roles\UpdateRole;
use App\Http\Requests\Roles\StoreRoleRequest;
use App\Http\Requests\Roles\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\Permission\Models\Role;

final class RoleController extends ApiController
{
    public function index(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Role::class);

        $roles = Role::with('permissions')->get();

        return RoleResource::collection($roles)
            ->additional([
                'meta' => (object) [],
                'message' => 'Roles retrieved successfully',
            ]);
    }

    public function store(StoreRoleRequest $request, StoreRole $action): JsonResponse
    {
        // Validation and authorization are handled in StoreRoleRequest
        $role = $action->handle($request->validated());

        return (new RoleResource($role->load('permissions')))
            ->withMessage('Role created successfully')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Role $role): JsonResponse
    {
        $this->authorize('view', $role);

        return (new RoleResource($role->load('permissions')))
            ->withMessage('Role retrieved successfully')
            ->response();
    }

    public function update(UpdateRoleRequest $request, Role $role, UpdateRole $action): JsonResponse
    {
        // Validation and authorization are handled in UpdateRoleRequest
        $updatedRole = $action->handle($role, $request->validated());

        return (new RoleResource($updatedRole->load('permissions')))
            ->withMessage('Role updated successfully')
            ->response();
    }

    public function destroy(Role $role, DeleteRole $action): JsonResponse
    {
        $this->authorize('delete', $role);

        $action->handle($role);

        return response()->json(null, 204);
    }
}
