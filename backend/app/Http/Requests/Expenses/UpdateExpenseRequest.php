<?php

namespace App\Http\Requests\Expenses;

use App\Models\Expense;
use Illuminate\Foundation\Http\FormRequest;

class UpdateExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        $expense = $this->route('expense');
        if (! $expense instanceof Expense) {
            $expense = Expense::find($this->route('id') ?? $this->route('expense'));
        }

        return $expense ? $this->user()->can('update', $expense) : false;
    }

    public function rules(): array
    {
        return [
            'category' => ['sometimes', 'required', 'string', 'max:255'],
            'amount' => ['sometimes', 'required', 'numeric', 'gt:0'],
            'date' => ['sometimes', 'required', 'date'],
            'description' => ['nullable', 'string'],
        ];
    }
}
