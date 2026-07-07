<?php

namespace App\Actions\EmployeePlanCommissionRules;

use App\Models\EmployeePlanCommissionRule;

class UpdateEmployeePlanCommissionRule
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(EmployeePlanCommissionRule $rule, array $data): EmployeePlanCommissionRule
    {
        $rule->update([
            'plan_id' => $data['plan_id'] ?? null,
            'calculation_type' => $data['calculation_type'],
            'value' => $data['value'],
            'is_active' => (bool) ($data['is_active'] ?? false),
        ]);

        return $rule->fresh(['plan']);
    }
}
