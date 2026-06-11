<?php

namespace App\Http\Requests\Members;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('member'));
    }

    public function rules(): array
    {
        $memberId = $this->route('member')?->id;

        return [
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => [
                'nullable',
                'email',
                'max:150',
                Rule::unique('members', 'email')->ignore($memberId),
            ],
            'gender' => ['nullable', 'in:male,female'],
            'birth_date' => ['nullable', 'date'],
            'national_id' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('members', 'national_id')->ignore($memberId),
            ],
            'join_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,inactive'],
        ];
    }
}
