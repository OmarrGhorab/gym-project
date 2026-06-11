<?php

namespace App\Http\Requests\Commissions;

use App\Models\Commission;
use Illuminate\Foundation\Http\FormRequest;

class BackfillCommissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('backfill', Commission::class);
    }

    /**
     * The backfill scans historical subscriptions/sales. Validate the optional
     * range and dry_run flag so malformed input returns 422 instead of a 500,
     * and bound the window so a single request cannot scan an unbounded span.
     */
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'dry_run' => ['nullable', 'boolean'],
        ];
    }
}
