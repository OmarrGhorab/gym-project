<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Subscription;
use App\Models\SubscriptionRefund;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('historical refunds can be previewed and reconciled without duplicate reversals', function (): void {
    $employee = Employee::factory()->create(['base_salary' => '3000.00']);
    $subscription = Subscription::factory()->stopped()->create([
        'price_paid' => '300.00',
        'start_date' => '2026-06-01',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => Payment::COLLECTED_STATUSES[0],
    ]);
    SubscriptionRefund::query()->create([
        'subscription_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
        'reason' => 'Historical refund',
        'created_by' => User::factory()->create()->id,
        'refunded_at' => now(),
    ]);
    Commission::query()->create([
        'employee_id' => $employee->id,
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'commission_type' => 'subscription_sale',
        'calculation_type' => 'percentage',
        'rate' => '0.1000',
        'rule_value' => '10.0000',
        'amount' => '30.00',
        'month' => '2026-06',
        'status' => 'pending',
    ]);
    $payroll = Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'base_salary' => '3000.00',
        'commissions_total' => '30.00',
        'net_salary' => '3030.00',
    ]);

    $this->artisan('commissions:reconcile-refunds --dry-run')
        ->expectsOutputToContain('Commission reversals needed: 1')
        ->assertSuccessful();

    expect(Commission::query()->where('commission_type', 'subscription_sale_refund')->count())->toBe(0)
        ->and($payroll->fresh()->commissions_total)->toBe('30.00');

    $this->artisan('commissions:reconcile-refunds')
        ->expectsOutputToContain('Commission reversals created: 1')
        ->assertSuccessful();

    $this->assertDatabaseHas('commissions', [
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'employee_id' => $employee->id,
        'commission_type' => 'subscription_sale_refund',
        'amount' => -30,
        'month' => '2026-06',
        'status' => 'pending',
    ]);
    expect($payroll->fresh()->commissions_total)->toBe('0.00')
        ->and($payroll->fresh()->net_salary)->toBe('3000.00');

    $this->artisan('commissions:reconcile-refunds')
        ->expectsOutputToContain('Commission reversals created: 0')
        ->assertSuccessful();

    expect(Commission::query()->where('commission_type', 'subscription_sale_refund')->count())->toBe(1);
});
