<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class PermissionResource extends JsonResource
{
    use WrapsApiResponse;

    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return is_array($this->resource) ? $this->resource : parent::toArray($request);
    }
}
