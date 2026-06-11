<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommissionResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'source' => [
                'type' => $this->source_type,
                'id' => $this->source_id,
            ],
            'rate' => number_format((float) $this->rate, 4, '.', ''),
            'amount' => number_format((float) $this->amount, 2, '.', ''),
            'month' => $this->month,
            'status' => $this->status,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
