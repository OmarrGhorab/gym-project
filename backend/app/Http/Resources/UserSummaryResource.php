<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Slim user embed for use inside other resources (e.g. SubscriptionResource
 * embedding the selling user via sold_by_user_id).
 *
 * Why not UserResource?
 * UserResource loads roles and permissions via Spatie's HasRoles trait,
 * which adds extra queries and unnecessarily exposes authz data in contexts
 * like subscription lists where only the seller's identity is needed.
 * This resource exposes only id + name — nothing more.
 *
 * Do NOT add roles, permissions, or email to this resource.
 * Reserve the full UserResource for auth/me responses (review M1).
 */
final class UserSummaryResource extends JsonResource
{
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
        ];
    }
}
