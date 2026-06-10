<?php

namespace App\Http\Requests\Members;

use Illuminate\Foundation\Http\FormRequest;

class StoreMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', \App\Models\Member::class);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150', 'unique:members,email'],
            'gender' => ['nullable', 'in:male,female'],
            'birth_date' => ['nullable', 'date'],
            'national_id' => ['nullable', 'string', 'max:50', 'unique:members,national_id'],
            'join_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
