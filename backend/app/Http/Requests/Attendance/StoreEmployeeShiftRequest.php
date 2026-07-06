<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class StoreEmployeeShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('settings.manage');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i'],
            'grace_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'off_days' => ['nullable', 'array', 'max:7'],
            'off_days.*' => ['integer', 'min:0', 'max:6'],
            'off_day_bonus_enabled' => ['sometimes', 'boolean'],
            'off_day_bonus_amount' => ['sometimes', 'numeric', 'min:0', 'max:999999.99'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
