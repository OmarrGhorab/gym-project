<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class FreezeSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('freeze', $this->route('subscription'));
    }

    public function rules(): array
    {
        return [
            'freeze_start' => ['required', 'date'],
            'freeze_end' => ['required', 'date', 'after_or_equal:freeze_start'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
