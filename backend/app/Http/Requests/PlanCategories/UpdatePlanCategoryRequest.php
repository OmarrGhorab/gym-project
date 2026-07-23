<?php

namespace App\Http\Requests\PlanCategories;

use App\Models\Plan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdatePlanCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', Plan::class);
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        $categoryId = $this->route('planCategory')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'slug' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('plan_categories', 'slug')->ignore($categoryId)],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
