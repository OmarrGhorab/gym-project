<?php

namespace App\Http\Requests\PlanCategories;

use App\Models\PlanCategory;
use App\Support\MembershipPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdatePlanCategoryRequest extends FormRequest
{
    /**
     * Checked against the permission rather than PlanPolicy: the policy's `update`
     * ability requires a Plan instance, and there is no plan in scope here.
     */
    public function authorize(): bool
    {
        return $this->user()->can(MembershipPermissions::PERM_PLANS_UPDATE);
    }

    /**
     * The slug is deliberately absent: plans reference categories by slug with no
     * foreign key, so renaming it would orphan every plan already pointing at it.
     * The display name stays editable.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'plan_scope' => ['sometimes', 'string', Rule::in(['gym_access', 'extra_service', 'fitness_studio'])],
            'plan_type' => ['sometimes', 'string', Rule::in(PlanCategory::PLAN_TYPES)],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
