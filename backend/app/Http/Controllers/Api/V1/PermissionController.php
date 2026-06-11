<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\PermissionResource;
use App\Support\PermissionMatrix;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Role;

final class PermissionController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Role::class);

        $grouped = PermissionMatrix::grouped();

        return (new PermissionResource($grouped))
            ->withMessage('Permissions catalog retrieved successfully')
            ->response();
    }
}
