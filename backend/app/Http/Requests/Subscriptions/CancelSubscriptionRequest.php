<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class CancelSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('stop', $this->route('subscription'));
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'method' => ['nullable', 'string', 'in:cash,card,bank_transfer'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
