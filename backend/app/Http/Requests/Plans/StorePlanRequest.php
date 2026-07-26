<?php

namespace App\Http\Requests\Plans;

use App\Models\Plan;
use App\Models\PlanCategory;
use App\Rules\ValidPlanCategory;
use Illuminate\Foundation\Http\FormRequest;

final class StorePlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Plan::class);
    }

    /**
     * MySQL compares strings case-insensitively and ignores trailing spaces, so
     * "GYM_ACCESS" and " gym_access " both resolve to the gym_access category —
     * but the raw value is what gets stored in plans.category, and business logic
     * compares it with a case-sensitive ===. Normalising here keeps the stored
     * value canonical.
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('category'))) {
            $this->merge(['category' => mb_strtolower(trim($this->input('category')))]);
        }
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
            'type' => ['required', 'string', 'in:membership,offer,offer_package,fitness_studio,extra_service,membership_extra_service'],
            'category' => [
                'required',
                'string',
                'max:'.PlanCategory::SLUG_MAX_LENGTH,
                new ValidPlanCategory($this->string('type')->toString() ?: null),
            ],
            'is_active' => ['sometimes', 'boolean'],
            'valid_from' => ['nullable', 'required_if:type,offer,offer_package', 'date'],
            'valid_to' => ['nullable', 'required_if:type,offer,offer_package', 'date', 'after_or_equal:valid_from'],
            'package_addons' => ['nullable', 'array'],
            'package_addons.*.plan_id' => ['required', 'integer', 'exists:plans,id'],
            'package_addons.*.coach_id' => ['required', 'integer', 'exists:employees,id'],
            'access_starts_at' => ['nullable', 'date_format:H:i,H:i:s'],
            'access_ends_at' => ['nullable', 'required_with:access_starts_at', 'date_format:H:i,H:i:s'],
            'max_freeze_days' => ['sometimes', 'integer', 'min:0', 'lte:duration_days'],
            'access_grace_days' => ['sometimes', 'integer', 'min:0'],
            'cancellation_grace_days' => ['sometimes', 'integer', 'min:0'],
            'min_freeze_days' => ['sometimes', 'integer', 'min:0', 'lte:max_freeze_days'],
            'freeze_requires_approval' => ['sometimes', 'boolean'],
        ];
    }
}
