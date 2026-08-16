<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\PermissionResource;
use App\Support\PermissionMatrix;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

final class PermissionController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Role::class);

        // Only what can actually be granted.
        //
        // The catalog is defined in code, but a role is saved against the
        // permissions table — so a permission added in a release whose seeder
        // has not run yet would render as a tickable box that fails validation
        // on save ("The selected permissions.0 is invalid"). Offering the
        // intersection means the screen can never promise a grant the database
        // will refuse; running RoleMatrixSeeder is what publishes new ones.
        $registered = Permission::query()->pluck('name')->all();

        $grouped = array_filter(array_map(
            static fn (array $permissions): array => array_values(array_intersect($permissions, $registered)),
            PermissionMatrix::grouped(),
        ));

        return (new PermissionResource($grouped))
            ->withMessage('Permissions catalog retrieved successfully')
            ->response();
    }
}
