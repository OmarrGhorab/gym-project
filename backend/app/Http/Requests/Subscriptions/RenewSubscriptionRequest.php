<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class RenewSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('renew', $this->route('subscription'));
    }

    public function rules(): array
    {
        return [
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            // 0 is legitimate: a discount can cover the whole renewal, or the member
            // pays later and the period opens with a balance due.
            'payment.amount' => ['required', 'numeric', 'min:0'],
            'payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'payment.paid_at' => ['nullable', 'date'],
            // Extras are re-bought per period, so a renewal can carry the member's
            // previous add-on services forward as new, separately-priced lines.
            'addons' => ['sometimes', 'array'],
            'addons.*.plan_id' => ['required', 'integer', 'exists:plans,id'],
            'addons.*.coach_id' => ['required', 'integer', 'exists:employees,id'],
            'addons.*.discount' => ['nullable', 'numeric', 'min:0'],
            'addons.*.payment.amount' => ['required', 'numeric', 'min:0'],
            'addons.*.payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'addons.*.payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
