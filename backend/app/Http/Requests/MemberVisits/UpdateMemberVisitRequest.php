<?php

namespace App\Http\Requests\MemberVisits;

use App\Models\MemberVisit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMemberVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        $visit = $this->route('memberVisit');

        return $visit instanceof MemberVisit
            ? $this->user()->can('update', $visit)
            : false;
    }

    public function rules(): array
    {
        return [
            'check_in_at' => ['sometimes', 'required', 'date'],
            'check_out_at' => ['nullable', 'date', 'after_or_equal:check_in_at'],
            'status' => ['sometimes', 'required', Rule::in(['allowed', 'blocked', 'flagged'])],
            'alert_reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
