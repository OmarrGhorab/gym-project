<?php

namespace App\Http\Requests\MemberVisits;

use App\Models\MemberVisit;
use Illuminate\Foundation\Http\FormRequest;

class ScanMemberVisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', MemberVisit::class);
    }

    public function rules(): array
    {
        return [
            'qr_token' => ['nullable', 'string', 'max:255'],
            'member_id' => ['nullable', 'integer', 'exists:members,id'],
            'phone' => ['nullable', 'string', 'max:30'],
            'name' => ['nullable', 'string', 'max:150'],
            'scan_method' => ['nullable', 'string', 'in:qr,scanner,manual,phone,name,member_id'],
            'subscription_addon_id' => ['nullable', 'integer', 'exists:subscription_addons,id'],
            'check_in_at' => ['nullable', 'date'],
            'check_out_at' => ['nullable', 'date'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy_meters' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if (! $this->filled('qr_token')
                && ! $this->filled('member_id')
                && ! $this->filled('phone')
                && ! $this->filled('name')) {
                $validator->errors()->add('member', 'Provide a QR token, member ID, phone, or name.');
            }
        });
    }
}
