<?php

namespace App\Http\Requests\Plans;

use App\Models\Plan;
use Illuminate\Foundation\Http\FormRequest;

final class StorePlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Plan::class);
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'duration_days' => ['required', 'integer', 'min:1'],
            'sessions_count' => ['nullable', 'integer', 'min:1'],
            'type' => ['required', 'string', 'in:membership,offer'],
            'is_active' => ['sometimes', 'boolean'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'max_freeze_days' => ['sometimes', 'integer', 'min:0', 'lte:duration_days'],
        ];
    }
}
