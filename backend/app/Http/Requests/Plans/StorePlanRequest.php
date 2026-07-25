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
            'duration_months' => ['nullable', 'integer', 'min:1'],
            'sessions_count' => ['nullable', 'required_if:is_unlimited_sessions,false', 'integer', 'min:1'],
            'is_unlimited_sessions' => ['sometimes', 'boolean'],
            'type' => ['required', 'string', 'in:membership,offer,fitness_studio,extra_service,membership_extra_service'],
            'category' => ['required', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
            'valid_from' => ['nullable', 'required_if:type,offer', 'date'],
            'valid_to' => ['nullable', 'required_if:type,offer', 'date', 'after_or_equal:valid_from'],
            'access_starts_at' => ['nullable', 'date_format:H:i'],
            'access_ends_at' => ['nullable', 'required_with:access_starts_at', 'date_format:H:i'],
            'max_freeze_days' => ['sometimes', 'integer', 'min:0', 'lte:duration_days'],
            'access_grace_days' => ['sometimes', 'integer', 'min:0'],
            'cancellation_grace_days' => ['sometimes', 'integer', 'min:0'],
            'min_freeze_days' => ['sometimes', 'integer', 'min:0', 'lte:max_freeze_days'],
            'freeze_requires_approval' => ['sometimes', 'boolean'],
        ];
    }
}
