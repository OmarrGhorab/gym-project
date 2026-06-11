<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'amount' => $this->amount,
            'method' => $this->method,
            'status' => $this->status,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'due_date' => $this->due_date?->toDateString(),
            'created_by' => $this->created_by,
        ];
    }
}
