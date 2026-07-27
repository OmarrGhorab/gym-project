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
            'coach_id' => ['nullable', 'integer', 'exists:employees,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment.amount' => ['required', 'numeric', 'gt:0'],
            'payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'payment.paid_at' => ['nullable', 'date'],
            'addons' => ['sometimes', 'array'],
            'addons.*.plan_id' => ['required', 'integer', 'exists:plans,id'],
            'addons.*.coach_id' => ['required', 'integer', 'exists:employees,id'],
            'addons.*.discount' => ['nullable', 'numeric', 'min:0'],
            'addons.*.payment.amount' => ['required', 'numeric', 'gt:0'],
            'addons.*.payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'addons.*.payment.paid_at' => ['nullable', 'date'],
            'included_addons' => ['sometimes', 'array'],
            'included_addons.*.plan_id' => ['required', 'integer', 'exists:plans,id'],
            'included_addons.*.coach_id' => ['required', 'integer', 'exists:employees,id'],
        ];
    }
}
