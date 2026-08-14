<?php

namespace App\Http\Requests\Reports;

use App\Support\ReportAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class FinancialReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return ReportAccess::canView($this->user());
    }

    /**
     * Default the range to the current month and grouping to "day" when the
     * client omits them, per the documented contract (defaults to current month).
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'from' => $this->input('from', Carbon::now()->startOfMonth()->toDateString()),
            'to' => $this->input('to', Carbon::now()->toDateString()),
            'group_by' => $this->input('group_by', 'day'),
        ]);
    }

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'group_by' => ['required', 'string', 'in:day,month'],
            'revenue_source' => ['nullable', 'string', Rule::in(['all', 'subscriptions', 'sales'])],
        ];
    }
}
