<?php

namespace App\Http\Requests\Payments;

use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('viewAny', Payment::class);
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', Rule::in(['due', 'paid', 'partial'])],
        ];
    }
}
