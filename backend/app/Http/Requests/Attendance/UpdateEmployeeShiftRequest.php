<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateEmployeeShiftRequest extends FormRequest
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
            'is_active' => ['required', 'boolean'],
        ];
    }
}
