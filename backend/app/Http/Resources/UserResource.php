<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes the authenticated User response.
 *
 * Includes identity, roles, and permissions.
 * Password, remember_token, and other sensitive fields are excluded by
 * the model's $hidden list and are never referenced here.
 *
 * Roles and permissions are eager-loaded by Spatie's HasRoles trait when
 * getRoleNames() and getAllPermissions() are called — no N+1 risk.
 */
final class UserResource extends JsonResource
{
    use WrapsApiResponse;

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->getRoleNames()->values()->all(),
            'permissions' => $this->getAllPermissions()->pluck('name')->values()->all(),
        ];
    }
}
