<?php

namespace App\Http\Requests\Reports;

use App\Support\ReportAccess;
use Illuminate\Foundation\Http\FormRequest;

class EmployeePerformanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return ReportAccess::canView($this->user());
    }

    public function rules(): array
    {
        return [
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }
}
