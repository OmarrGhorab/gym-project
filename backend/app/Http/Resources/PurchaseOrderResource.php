<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    use WrapsApiResponse;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'supplier_name' => $this->supplier_name,
            'supplier_phone' => $this->supplier_phone,
            'ordered_at' => $this->ordered_at?->toDateString(),
            'expected_at' => $this->expected_at?->toDateString(),
            'received_at' => $this->received_at?->toIso8601String(),
            'status' => $this->status,
            'subtotal' => $this->subtotal,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'received_by' => $this->received_by,
            'items' => PurchaseOrderItemResource::collection($this->whenLoaded('items')),
            'creator' => new UserResource($this->whenLoaded('creator')),
            'receiver' => new UserResource($this->whenLoaded('receiver')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
