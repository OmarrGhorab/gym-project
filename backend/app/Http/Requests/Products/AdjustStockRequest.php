<?php

namespace App\Http\Requests\Products;

use Illuminate\Foundation\Http\FormRequest;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('adjustStock', $this->route('product'));
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', 'in:in,out'],
            'quantity' => ['required', 'integer', 'gt:0'],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }
}
