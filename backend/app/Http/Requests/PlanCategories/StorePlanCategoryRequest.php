<?php

namespace App\Http\Requests\PlanCategories;

use App\Models\Plan;
use App\Models\PlanCategory;
use Illuminate\Contracts\Validation\Validator;
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
            'slug' => [
                'nullable',
                'string',
                'max:'.PlanCategory::SLUG_MAX_LENGTH,
                Rule::unique('plan_categories', 'slug'),
            ],
            'plan_scope' => ['sometimes', 'string', Rule::in(['gym_access', 'extra_service', 'fitness_studio'])],
            'plan_type' => ['sometimes', 'string', Rule::in(PlanCategory::PLAN_TYPES)],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Callers send a name, and the model derives the slug from it. Nothing was
     * validating that derived value, so a name like "###" produced an empty slug
     * and a repeated name produced a duplicate one — both surfacing as a 500 from
     * the unique index rather than a field error the form could show.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->has('name') || $this->filled('slug')) {
                return;
            }

            $slug = PlanCategory::slugFor((string) $this->input('name'));

            if ($slug === '') {
                $validator->errors()->add(
                    'name',
                    'Please include at least one letter or number in the category name.'
                );

                return;
            }

            if (mb_strlen($slug) > PlanCategory::SLUG_MAX_LENGTH) {
                $validator->errors()->add(
                    'name',
                    'This name is too long to use as a category key. Please shorten it.'
                );

                return;
            }

            $existing = PlanCategory::query()->where('slug', $slug)->first();

            if ($existing !== null) {
                $validator->errors()->add('name', $existing->is_active
                    ? 'A category with this name already exists.'
                    : "A retired category called \"{$existing->name}\" already uses this name — restore it instead.");
            }
        });
    }
}
