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
            'phone' => ['required', 'string', 'regex:/^(?:\+20|0020|0)?1[0125][0-9]{8}$/'],
            'email' => [
                'nullable',
                'email',
                'max:150',
                Rule::unique('members', 'email')->ignore($memberId),
            ],
            'gender' => ['nullable', 'in:male,female'],
            'national_id' => [
                'nullable',
                'string',
                'regex:/^[23][0-9]{13}$/',
                Rule::unique('members', 'national_id')->ignore($memberId),
            ],
            'join_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,inactive'],
        ];
    }
}
