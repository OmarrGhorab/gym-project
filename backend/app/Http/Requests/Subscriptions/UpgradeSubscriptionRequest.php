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
            'credit_mode' => ['nullable', 'string', 'in:full_difference,day_proration'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'amount_due' => ['nullable', 'numeric', 'min:0'],
            'payment.amount' => ['required', 'numeric', 'min:0'],
            'payment.method' => ['required', 'string', 'max:50'],
            'payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
