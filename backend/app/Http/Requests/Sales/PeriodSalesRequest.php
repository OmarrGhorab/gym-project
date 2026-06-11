<?php

namespace App\Http\Requests\Sales;

use App\Support\PosPermissions;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class PeriodSalesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can(PosPermissions::PERM_REPORTS_VIEW);
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'group_by' => ['required', 'string', 'in:product,cashier,day'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'cashier_id' => ['nullable', 'integer', 'exists:users,id'],
        ];
    }

    /**
     * Configure the validator instance.
     *
     * @param  Validator  $validator
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if ($this->has(['from', 'to'])) {
                try {
                    $from = Carbon::createFromFormat('Y-m-d', $this->input('from'))->startOfDay();
                    $to = Carbon::createFromFormat('Y-m-d', $this->input('to'))->startOfDay();

                    if ($from->diffInDays($to) > 366) {
                        $validator->errors()->add('from', 'The date range cannot exceed 366 days.');
                    }
                } catch (\Exception) {
                    // Let date_format validation handle formatting errors
                }
            }
        });
    }
}
