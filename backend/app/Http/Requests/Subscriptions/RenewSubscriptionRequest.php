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
            'payment.amount' => ['required', 'numeric', 'gt:0'],
            'payment.method' => ['required', 'string', 'max:50'],
            'payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
