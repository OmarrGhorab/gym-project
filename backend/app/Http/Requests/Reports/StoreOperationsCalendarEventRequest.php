<?php

namespace App\Http\Requests\Reports;

use App\Support\PosPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOperationsCalendarEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can(PosPermissions::PERM_REPORTS_VIEW);
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'title' => ['required', 'string', 'max:191'],
            'type' => ['nullable', 'string', Rule::in(['manual', 'renewal', 'payroll', 'attendance', 'inventory', 'finance'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
