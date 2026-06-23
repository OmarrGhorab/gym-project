<?php

namespace App\Http\Requests\Subscriptions;

use App\Models\Subscription;
use Illuminate\Foundation\Http\FormRequest;

class StoreSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Subscription::class);
    }

    public function rules(): array
    {
        return [
            'member_id' => ['required', 'integer', 'exists:members,id'],
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment.amount' => ['required', 'numeric', 'gt:0'],
            'payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
