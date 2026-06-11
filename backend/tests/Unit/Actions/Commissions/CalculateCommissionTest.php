<?php

namespace Tests\Unit\Actions\Commissions;

use App\Actions\Commissions\CalculateCommission;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CalculateCommissionTest extends TestCase
{
    use RefreshDatabase;

    private CalculateCommission $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = app(CalculateCommission::class);
    }

    public function test_it_resolves_employee_default_rate_and_calculates_commission_amount(): void
    {
        $user = User::factory()->create();
        $employee = Employee::factory()->captain()->create([
            'user_id' => $user->id,
            'commission_rate' => 0.1000,
        ]);

        $sale = Sale::factory()->create([
            'sold_by_user_id' => $user->id,
            'total' => 350.00,
        ]);

        $commission = $this->action->forSource($sale);

        $this->assertNotNull($commission);
        $this->assertEquals($employee->id, $commission->employee_id);
        $this->assertEquals('0.1000', $commission->rate);
        $this->assertEquals('35.00', $commission->amount);
    }

    public function test_it_skips_calculation_when_user_is_not_linked_to_employee(): void
    {
        $user = User::factory()->create();

        $sale = Sale::factory()->create([
            'sold_by_user_id' => $user->id,
            'total' => 350.00,
        ]);

        $commission = $this->action->forSource($sale);

        $this->assertNull($commission);
    }

    public function test_it_resolves_plan_override_rate_for_subscriptions(): void
    {
        $user = User::factory()->create();
        $employee = Employee::factory()->captain()->create([
            'user_id' => $user->id,
            'commission_rate' => 0.1000,
        ]);

        $plan = Plan::factory()->create([
            'commission_rate' => 0.1200,
        ]);

        $subscription = Subscription::factory()->create([
            'sold_by_user_id' => $user->id,
            'plan_id' => $plan->id,
            'price_paid' => 500.00,
        ]);

        $commission = $this->action->forSource($subscription);

        $this->assertNotNull($commission);
        $this->assertEquals('0.1200', $commission->rate);
        $this->assertEquals('60.00', $commission->amount);
    }
}
