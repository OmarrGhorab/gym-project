<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('upgrade', $this->route('subscription'));
    }

    /**
     * Corrects a membership that was rung up wrong — a mistyped date or price.
     * Deliberately narrow: money already collected is never rewritten here, so
     * a correction cannot quietly restate revenue for a day that has closed.
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
        ];
    }

    /**
     * `after_or_equal:start_date` only fires when both dates are posted. When
     * staff correct just one of them, compare against the date already stored
     * or a single edit could leave the period ending before it starts.
     */
    protected function withValidator(\Illuminate\Validation\Validator $validator): void
    {
        $validator->after(function (\Illuminate\Validation\Validator $validator): void {
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
        });
    }
}
