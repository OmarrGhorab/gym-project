<?php

namespace App\Http\Requests\Reports;

use App\Support\PosPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MemberSubscriptionsReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can(PosPermissions::PERM_REPORTS_VIEW);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'expired', 'frozen', 'stopped'])],
            'plan_id' => ['sometimes', 'nullable', 'integer', 'exists:plans,id'],
            'coach_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            // Drill-down: returns that member's full subscription history instead of the table.
            'member_id' => ['sometimes', 'nullable', 'integer', 'exists:members,id'],
            // Deepest drill-down: the full check-in and payment log for one subscription.
            'subscription_id' => ['sometimes', 'nullable', 'integer', 'exists:subscriptions,id'],
            'limit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:2000'],
        ];
    }
}
