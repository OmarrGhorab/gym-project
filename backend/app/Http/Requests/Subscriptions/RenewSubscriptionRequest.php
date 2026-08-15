<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class RenewSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('renew', $this->route('subscription'));
    }

    /**
     * A renewal defaults to the plan exactly as it is sold. Every override
     * below is optional and, when sent, replaces one of those defaults for this
     * one member: what the period costs, how long it runs, how many sessions it
     * carries. Admins are told whenever any of them is used.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'coach_id' => ['nullable', 'integer', 'exists:employees,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            // The period price before discount. Omitted, the plan's own price is
            // charged; sent, the member is on a price only this renewal knows.
            'price' => ['nullable', 'numeric', 'min:0', 'max:9999999.99'],
            // Runs the period to a date of the desk's choosing instead of the
            // length the plan implies. Compared against the computed start date
            // in the action, which is where that date is known.
            'end_date' => ['nullable', 'date'],
            'sessions_total' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'unlimited_sessions' => ['sometimes', 'boolean'],
            // 0 is legitimate: a discount can cover the whole renewal, or the member
            // pays later and the period opens with a balance due.
            'payment.amount' => ['required', 'numeric', 'min:0'],
            'payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'payment.paid_at' => ['nullable', 'date'],
            // Money over the price stays money unless this says otherwise.
            'payment.extend_days_for_overpayment' => ['sometimes', 'boolean'],
            // Extras are re-bought per period, so a renewal can carry the member's
            // previous add-on services forward as new, separately-priced lines.
            'addons' => ['sometimes', 'array'],
            'addons.*.plan_id' => ['required', 'integer', 'exists:plans,id'],
            'addons.*.coach_id' => ['required', 'integer', 'exists:employees,id'],
            'addons.*.discount' => ['nullable', 'numeric', 'min:0'],
            'addons.*.payment.amount' => ['required', 'numeric', 'min:0'],
            'addons.*.payment.method' => ['required', 'string', 'in:cash,card,bank_transfer'],
            'addons.*.payment.paid_at' => ['nullable', 'date'],
        ];
    }
}
