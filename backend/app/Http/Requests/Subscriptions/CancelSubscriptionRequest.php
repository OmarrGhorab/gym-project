<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class CancelSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $subscription = $this->route('subscription');

        return $this->user()->can('stop', $subscription)
            && (! $this->boolean('force') || $this->user()->can('forceRefund', $subscription));
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'refund_scope' => ['nullable', 'string', 'in:full_package,main_plan'],
            'method' => ['nullable', 'string', 'in:cash,card,bank_transfer'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'force' => ['nullable', 'boolean'],
        ];
    }
}
