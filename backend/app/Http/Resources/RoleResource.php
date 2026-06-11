<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use App\Support\FoundationPermissions;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class RoleResource extends JsonResource
{
    use WrapsApiResponse;

    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'is_preset' => in_array($this->name, FoundationPermissions::ALL_ROLES, true),
            'permissions' => $this->relationLoaded('permissions')
                ? $this->permissions->pluck('name')->values()->all()
                : $this->permissions()->pluck('name')->values()->all(),
        ];
    }
}
