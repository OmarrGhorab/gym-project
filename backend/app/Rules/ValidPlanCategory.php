<?php

namespace App\Rules;

use App\Models\PlanCategory;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Ties `plans.category` to the plan_categories lookup table. Before this, the
 * column was free text, so the API happily accepted a plan with
 * type=membership and category=jiu_jitsu, or a category that existed nowhere.
 */
final class ValidPlanCategory implements ValidationRule
{
    /**
     * @param  string|null  $planType  the type the plan is being saved with
     * @param  string|null  $currentValue  the category the plan already has, if any
     */
    public function __construct(
        private readonly ?string $planType = null,
        private readonly ?string $currentValue = null,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            // `required` already reports this; don't stack a second message.
            return;
        }

        // An existing plan must stay editable even if its category was since
        // retired or re-scoped — otherwise deactivating a category would lock
        // every plan using it, including just toggling it off.
        if ($this->currentValue !== null && $value === $this->currentValue) {
            return;
        }

        $category = PlanCategory::query()->where('slug', $value)->first();

        if ($category === null) {
            $fail('The selected category does not exist. Add it first from the plan form or Plans → Categories.');

            return;
        }

        if (! $category->is_active) {
            $fail("The \"{$category->name}\" category is no longer active.");

            return;
        }

        if ($this->planType !== null && ! $category->supportsType($this->planType)) {
            $fail("The \"{$category->name}\" category is not available for this plan type.");
        }
    }
}
