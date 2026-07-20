<?php

namespace App\Http\Requests\MemberVisits;

use App\Models\MemberVisit;
use Illuminate\Foundation\Http\FormRequest;

class StoreMemberVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', MemberVisit::class);
    }

    public function rules(): array
    {
        return [
            'member_id' => ['required', 'integer', 'exists:members,id'],
            'subscription_addon_id' => ['nullable', 'integer', 'exists:subscription_addons,id'],
            'check_in_at' => ['nullable', 'date'],
            'check_out_at' => ['nullable', 'date', 'after_or_equal:check_in_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
