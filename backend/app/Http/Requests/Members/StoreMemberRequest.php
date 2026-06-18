<?php

namespace App\Http\Requests\Members;

use App\Models\Member;
use App\Models\Subscription;
use Illuminate\Foundation\Http\FormRequest;

class StoreMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (! $this->user()->can('create', Member::class)) {
            return false;
        }

        if ($this->filled('subscription')) {
            return $this->user()->can('create', Subscription::class);
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150', 'unique:members,email'],
            'gender' => ['nullable', 'in:male,female'],
            'birth_date' => ['nullable', 'date'],
            'national_id' => ['nullable', 'string', 'max:50', 'unique:members,national_id'],
            'join_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'subscription' => ['nullable', 'array'],
            'subscription.plan_id' => ['required_with:subscription', 'integer', 'exists:plans,id'],
            'subscription.start_date' => ['required_with:subscription', 'date'],
            'subscription.discount' => ['nullable', 'numeric', 'min:0'],
            'subscription.payment' => ['required_with:subscription', 'array'],
            'subscription.payment.amount' => ['required_with:subscription', 'numeric', 'gt:0'],
            'subscription.payment.method' => ['required_with:subscription', 'string', 'in:cash,card,bank_transfer'],
            'subscription.payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
