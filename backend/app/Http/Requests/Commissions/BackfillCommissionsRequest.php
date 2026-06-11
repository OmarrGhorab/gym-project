<?php

namespace App\Http\Requests\Commissions;

use App\Models\Commission;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class BackfillCommissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('backfill', Commission::class);
    }

    /**
     * Default to the last 90 days when no range is supplied so a call with no
     * body never triggers a full-table scan. Cap the window at 366 days so even
     * an explicit range cannot produce an unbounded HTTP-synchronous operation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'from' => $this->input('from') ?? Carbon::now()->subDays(90)->toDateString(),
            'to' => $this->input('to') ?? Carbon::now()->toDateString(),
        ]);
    }

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from', function (string $attribute, mixed $value, \Closure $fail): void {
                $from = $this->input('from');
                try {
                    if ($from && Carbon::createFromFormat('Y-m-d', (string) $from)->diffInDays(Carbon::createFromFormat('Y-m-d', (string) $value)) > 366) {
                        $fail('The backfill range may not exceed 366 days.');
                    }
                } catch (\Throwable) {
                    // Unparseable date — the date_format rule handles the error.
                }
            }],
            'dry_run' => ['nullable', 'boolean'],
        ];
    }
}
