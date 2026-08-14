<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('upgrade', $this->route('subscription'));
    }

    /**
     * Corrects the member-specific snapshot captured when a membership was
     * sold. Money already collected is never rewritten here, so a correction
     * cannot quietly restate revenue for a day that has closed.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date' => ['sometimes', 'required', 'date', 'after_or_equal:start_date'],
            'price_paid' => ['sometimes', 'required', 'numeric', 'min:0'],
            'discount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'cancellation_grace_days' => ['sometimes', 'required', 'integer', 'min:0', 'max:3650'],
            'sessions_total' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
            'sessions_remaining' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }

    /**
     * `after_or_equal:start_date` only fires when both dates are posted. When
     * staff correct just one of them, compare against the date already stored
     * or a single edit could leave the period ending before it starts.
     */
    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $subscription = $this->route('subscription');

            $start = $this->filled('start_date')
                ? $this->date('start_date')
                : $subscription->start_date;
            $end = $this->filled('end_date')
                ? $this->date('end_date')
                : $subscription->end_date;

            if ($start && $end && $end->lt($start)) {
                $validator->errors()->add('end_date', 'The end date must be on or after the start date.');
            }

            if ($validator->errors()->has('sessions_total') || $validator->errors()->has('sessions_remaining')) {
                return;
            }

            $total = $this->exists('sessions_total')
                ? $this->input('sessions_total')
                : $subscription->sessions_total;
            $remaining = $this->exists('sessions_remaining')
                ? $this->input('sessions_remaining')
                : $subscription->sessions_remaining;

            // Null/null is the single representation of unlimited access. A
            // half-null pair is ambiguous and can either block every visit or
            // make the member look unlimited while retaining a hidden balance.
            if (($total === null) !== ($remaining === null)) {
                $validator->errors()->add(
                    'sessions_remaining',
                    'Total and remaining sessions must both be blank for unlimited access, or both contain a number.'
                );

                return;
            }

            if ($total !== null && (int) $remaining > (int) $total) {
                $validator->errors()->add(
                    'sessions_remaining',
                    'Sessions remaining cannot be greater than total sessions.'
                );
            }
        });
    }
}
