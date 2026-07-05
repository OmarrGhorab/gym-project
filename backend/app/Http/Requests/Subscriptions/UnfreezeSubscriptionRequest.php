<?php

namespace App\Http\Requests\Subscriptions;

use Illuminate\Foundation\Http\FormRequest;

class UnfreezeSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('freeze', $this->route('subscription'));
    }

    public function rules(): array
    {
        return [
            'resume_on' => ['nullable', 'date'],
        ];
    }
}
