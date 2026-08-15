<?php

namespace App\Http\Requests\Payments;

use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Payment::class);
    }

    public function rules(): array
    {
        return [
            'subscription_id' => ['required', 'integer', 'exists:subscriptions,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'paid_at' => ['nullable', 'date'],
            // Anything above the balance is kept as money unless the desk asks
            // for it to buy time instead. See RecordPayment.
            'extend_days_for_overpayment' => ['sometimes', 'boolean'],
        ];
    }
}
