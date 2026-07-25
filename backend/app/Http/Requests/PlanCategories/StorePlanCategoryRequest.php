<?php

namespace App\Http\Requests\PlanCategories;

use App\Models\Plan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StorePlanCategoryRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['nullable', 'string', 'max:100', Rule::unique('plan_categories', 'slug')],
            'plan_scope' => ['sometimes', 'string', Rule::in(['gym_access', 'extra_service', 'fitness_studio'])],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
