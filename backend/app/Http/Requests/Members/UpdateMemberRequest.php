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
            'emergency_contact_name' => ['nullable', 'string', 'max:150'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:30'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'join_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'goals' => ['nullable', 'string', 'max:2000'],
            'injuries' => ['nullable', 'string', 'max:2000'],
            'medical_notes' => ['nullable', 'string', 'max:2000'],
            'tags' => ['nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:40'],
            'coach_id' => ['nullable', 'integer', 'exists:employees,id'],
            'status' => ['nullable', 'in:active,inactive'],
        ];
    }
}
