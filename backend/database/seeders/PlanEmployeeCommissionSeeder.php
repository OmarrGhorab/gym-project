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
     * Seed plan-to-coach commission rules for studio plans and add-ons.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $serviceAndStudioPlans = Plan::query()
                ->where('category', '!=', 'gym_access')
                ->where('is_active', true)
                ->get();

            $coaches = Employee::query()
                ->whereIn('role', ['coach', 'captain', 'trainer'])
                ->get();

            if ($coaches->isEmpty()) {
                return;
            }

            foreach ($serviceAndStudioPlans as $plan) {
                // Assign first 2 coaches to each service plan with standard rules
                foreach ($coaches->take(2) as $coach) {
                    $isStudioPlan = $plan->type === 'fitness_studio' || in_array($plan->category, ['fitness_studio', 'jiu_jitsu'], true);

                    EmployeePlanCommissionRule::query()->updateOrCreate(
                        [
                            'employee_id' => $coach->id,
                            'plan_id' => $plan->id,
                        ],
                        [
                            'calculation_type' => $isStudioPlan ? 'percentage' : 'fixed',
                            'value' => $isStudioPlan ? 10.0000 : 150.00,
                            'is_active' => true,
                        ],
                    );
                }
            }
        });
    }
}
