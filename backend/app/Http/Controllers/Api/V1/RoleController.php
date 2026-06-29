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
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

final class RoleController extends ApiController
{
    public function index(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Role::class);

        $roles = Role::with('permissions')->paginate(15);
        $userCounts = DB::table(config('permission.table_names.model_has_roles', 'model_has_roles'))
            ->select('role_id', DB::raw('COUNT(*) as users_count'))
            ->where('model_type', config('auth.providers.users.model'))
            ->groupBy('role_id')
            ->pluck('users_count', 'role_id');

        $roles->getCollection()->each(function (Role $role) use ($userCounts): void {
            $role->setAttribute('users_count', (int) ($userCounts[$role->id] ?? 0));
        });

        return RoleResource::collection($roles)
            ->additional([
                'meta' => [
                    'current_page' => $roles->currentPage(),
                    'per_page' => $roles->perPage(),
                    'total' => $roles->total(),
                    'last_page' => $roles->lastPage(),
                ],
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
            ->response()
            ->setStatusCode(200);
    }

    public function update(UpdateRoleRequest $request, Role $role, UpdateRole $action): JsonResponse
    {
        // Validation and authorization are handled in UpdateRoleRequest
        $updatedRole = $action->handle($role, $request->validated());

        return (new RoleResource($updatedRole->load('permissions')))
            ->withMessage('Role updated successfully')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Role $role, DeleteRole $action): JsonResponse
    {
        $this->authorize('delete', $role);

        $action->handle($role);

        return response()->json(null, 204);
    }
}
