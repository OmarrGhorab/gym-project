<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class UpgradeSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('upgrade', $this->route('subscription'));
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            // A studio plan carries its coach; without this the picked coach was
            // dropped and the new period was created unassigned.
            'coach_id' => ['nullable', 'integer', 'exists:employees,id'],
            'credit_mode' => ['nullable', 'string', 'in:full_difference,day_proration'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'amount_due' => ['nullable', 'numeric', 'min:0'],
            'payment.amount' => ['required', 'numeric', 'min:0'],
            'payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'payment.paid_at' => ['nullable', 'date'],
            // The dialog has always posted these, but with no rules here
            // `validated()` stripped them and every extra service picked during a
            // plan change was silently discarded.
            'addons' => ['sometimes', 'array'],
            'addons.*.plan_id' => ['required', 'integer', 'exists:plans,id'],
            'addons.*.coach_id' => ['required', 'integer', 'exists:employees,id'],
            'addons.*.discount' => ['nullable', 'numeric', 'min:0'],
            'addons.*.payment.amount' => ['required', 'numeric', 'min:0'],
            'addons.*.payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'addons.*.payment.paid_at' => ['nullable', 'date'],
            'included_addons' => ['sometimes', 'array'],
            'included_addons.*.plan_id' => ['required', 'integer', 'exists:plans,id'],
            'included_addons.*.coach_id' => ['required', 'integer', 'exists:employees,id'],
        ];
    }
}
