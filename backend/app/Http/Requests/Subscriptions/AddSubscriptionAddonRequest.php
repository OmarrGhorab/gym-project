<?php

namespace App\Http\Requests\Subscriptions;

use App\Models\Subscription;
use Illuminate\Foundation\Http\FormRequest;

class AddSubscriptionAddonRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var Subscription $subscription */
        $subscription = $this->route('subscription');

        return $this->user()?->can('upgrade', $subscription) ?? false;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'coach_id' => ['nullable', 'integer', 'exists:employees,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date'],
            'payment.amount' => ['required', 'numeric', 'min:0'],
            'payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
