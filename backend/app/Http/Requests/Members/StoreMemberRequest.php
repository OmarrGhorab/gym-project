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
            'phone' => ['required', 'string', 'unique:members,phone', 'regex:/^(?:\+20|0020|0)?1[0125][0-9]{8}$/'],
            'email' => ['nullable', 'email', 'max:150', 'unique:members,email'],
            'gender' => ['nullable', 'in:male,female'],
            'national_id' => ['nullable', 'string', 'regex:/^[23][0-9]{13}$/', 'unique:members,national_id'],
            'emergency_contact_name' => ['nullable', 'string', 'max:150'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:30'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'join_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'goals' => ['nullable', 'string', 'max:2000'],
            'injuries' => ['nullable', 'string', 'max:2000'],
            'medical_notes' => ['nullable', 'string', 'max:2000'],
            'tags' => ['nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:40'],
            'coach_id' => ['nullable', 'integer', 'exists:employees,id'],
            'subscription' => ['nullable', 'array'],
            'subscription.plan_id' => ['required_with:subscription', 'integer', 'exists:plans,id'],
            'subscription.start_date' => ['required_with:subscription', 'date'],
            'subscription.end_date' => ['required_with:subscription', 'date', 'after_or_equal:subscription.start_date'],
            'subscription.discount' => ['nullable', 'numeric', 'min:0'],
            'subscription.payment' => ['required_with:subscription', 'array'],
            'subscription.payment.amount' => ['required_with:subscription', 'numeric', 'gt:0'],
            'subscription.payment.method' => ['required_with:subscription', 'string', 'in:cash,card,bank_transfer'],
            'subscription.payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
