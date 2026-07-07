<?php

namespace App\Actions\EmployeePlanCommissionRules;

use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;

class StoreEmployeePlanCommissionRule
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Employee $employee, array $data): EmployeePlanCommissionRule
    {
        return $employee->planCommissionRules()->create([
            'plan_id' => $data['plan_id'] ?? null,
            'calculation_type' => $data['calculation_type'],
            'value' => $data['value'],
            'is_active' => (bool) ($data['is_active'] ?? true),
        ])->load('plan');
    }
}
