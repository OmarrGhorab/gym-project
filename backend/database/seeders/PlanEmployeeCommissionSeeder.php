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
            $servicePlans = Plan::query()
                ->where('category', '!=', 'gym_access')
                ->where('is_active', true)
                ->get();

            $coaches = Employee::query()
                ->whereIn('phone', [
                    '+201011110004',
                    '+201011110005',
                    '+201011110006',
                    '+201011110007',
                ])
                ->get()
                ->keyBy('phone');

            $coachAssignments = [
                '+201011110004' => [
                    'plans' => ['8 Personal Training Sessions', '12 Personal Training Sessions', 'Recovery Massage Package'],
                    'type' => 'percentage',
                    'value' => 10.0000,
                ],
                '+201011110005' => [
                    'plans' => ['8 Personal Training Sessions', '12 Personal Training Sessions', 'Classes Monthly'],
                    'type' => 'fixed',
                    'value' => 180.00,
                ],
                '+201011110006' => [
                    'plans' => ['Nutrition Follow-up Monthly', 'Classes Monthly'],
                    'type' => 'fixed',
                    'value' => 150.00,
                ],
                '+201011110007' => [
                    'plans' => ['Classes Monthly', 'Recovery Massage Package'],
                    'type' => 'percentage',
                    'value' => 8.5000,
                ],
            ];

            foreach ($coachAssignments as $phone => $assignment) {
                $employee = $coaches->get($phone);

                if ($employee === null) {
                    continue;
                }

                foreach ($assignment['plans'] as $planName) {
                    $plan = $servicePlans->firstWhere('name', $planName);

                    if ($plan === null) {
                        continue;
                    }

                    EmployeePlanCommissionRule::query()->updateOrCreate(
                        [
                            'employee_id' => $employee->id,
                            'plan_id' => $plan->id,
                        ],
                        [
                            'calculation_type' => $assignment['type'],
                            'value' => $assignment['value'],
                            'is_active' => true,
                        ],
                    );
                }
            }
        });
    }
}
