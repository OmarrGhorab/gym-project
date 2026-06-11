<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    use WrapsApiResponse;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'sku' => $this->sku,
            'price' => $this->price,
            'cost' => $this->cost,
            'stock_quantity' => $this->stock_quantity,
            'low_stock_threshold' => $this->low_stock_threshold,
            'image' => $this->image,
            'image_url' => $this->image ? url("/api/v1/products/{$this->id}/image") : null,
            'is_active' => $this->is_active,
            'is_low_stock' => $this->is_low_stock,
            'inventory_movements' => InventoryMovementResource::collection($this->whenLoaded('inventoryMovements')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
