<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Plan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlanEmployeeCommissionSeeder extends Seeder
{
    /**
     * Seed sample plan-to-coach commission rules for membership sales and add-ons.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $plans = Plan::query()->whereIn('name', [
                'Monthly Gym Access',
                'Premium Monthly',
                'Quarterly Transformation',
                'Yearly VIP',
                'Classes Monthly',
                '8 Personal Training Sessions',
                '12 Personal Training Sessions',
            ])->get()->keyBy('name');

            $employees = Employee::query()->whereIn('phone', [
                '+201011110004',
                '+201011110005',
                '+201011110006',
                '+201011110007',
            ])->get()->keyBy('phone');

            $rules = [
                ['employee_phone' => '+201011110004', 'plan' => 'Monthly Gym Access', 'type' => 'percentage', 'value' => 4.0000],
                ['employee_phone' => '+201011110004', 'plan' => 'Quarterly Transformation', 'type' => 'percentage', 'value' => 6.0000],
                ['employee_phone' => '+201011110005', 'plan' => 'Quarterly Transformation', 'type' => 'fixed', 'value' => 180.00],
                ['employee_phone' => '+201011110005', 'plan' => 'Yearly VIP', 'type' => 'fixed', 'value' => 350.00],
                ['employee_phone' => '+201011110006', 'plan' => 'Premium Monthly', 'type' => 'percentage', 'value' => 5.0000],
                ['employee_phone' => '+201011110006', 'plan' => 'Classes Monthly', 'type' => 'fixed', 'value' => 120.00],
                ['employee_phone' => '+201011110007', 'plan' => '8 Personal Training Sessions', 'type' => 'percentage', 'value' => 7.5000],
                ['employee_phone' => '+201011110007', 'plan' => '12 Personal Training Sessions', 'type' => 'percentage', 'value' => 8.5000],
            ];

            foreach ($rules as $rule) {
                $employee = $employees->get($rule['employee_phone']);
                $plan = $plans->get($rule['plan']);

                if ($employee === null || $plan === null) {
                    continue;
                }

                EmployeePlanCommissionRule::query()->updateOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'plan_id' => $plan->id,
                    ],
                    [
                        'calculation_type' => $rule['type'],
                        'value' => $rule['value'],
                        'is_active' => true,
                    ],
                );
            }
        });
    }
}
