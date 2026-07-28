<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('full package refund offsets seller and coach commissions for membership and add ons', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['cancellation_grace_days' => 2]);
    $addonPlan = Plan::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'price_paid' => '300.00',
        'cancellation_grace_days' => 2,
    ]);
    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $addonPlan->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'status' => 'active',
        'price_paid' => '100.00',
        'discount' => '0.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);
    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '100.00',
        'status' => 'paid',
    ]);

    $seller = Employee::factory()->create();
    $coach = Employee::factory()->create();
    createCommission($subscription, $seller, 'subscription_sale', '30.00');
    createCommission($subscription, $coach, 'subscription_coach', '60.00');
    createCommission($addon, $seller, 'subscription_addon_sale', '10.00');
    createCommission($addon, $coach, 'subscription_addon_coach', '20.00');

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.billing_status', 'refunded');

    expect(Commission::query()->where('commission_type', 'like', '%_refund')->count())->toBe(4)
        ->and((string) Commission::query()->sum('amount'))->toBe('0');

    $this->assertDatabaseHas('commissions', [
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'employee_id' => $seller->id,
        'commission_type' => 'subscription_sale_refund',
        'amount' => -30,
        'month' => '2026-06',
        'status' => 'pending',
    ]);
    $this->assertDatabaseHas('commissions', [
        'source_type' => SubscriptionAddon::class,
        'source_id' => $addon->id,
        'employee_id' => $coach->id,
        'commission_type' => 'subscription_addon_coach_refund',
        'amount' => -20,
        'month' => '2026-06',
        'status' => 'pending',
    ]);
});

test('partial refund reverses the same proportion of each commission', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $subscription = Subscription::factory()->active()->create([
        'start_date' => '2026-06-10',
        'price_paid' => '500.00',
        'cancellation_grace_days' => 2,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '500.00',
        'status' => 'paid',
    ]);
    $employee = Employee::factory()->create();
    createCommission($subscription, $employee, 'subscription_sale', '50.00');

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel", [
        'refund_amount' => '200.00',
    ])->assertOk();

    $this->assertDatabaseHas('commissions', [
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'employee_id' => $employee->id,
        'commission_type' => 'subscription_sale_refund',
        'amount' => -20,
        'status' => 'pending',
    ]);
});

test('extra service refund offsets its seller and coach commissions', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
    ]);
    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->active()->create()->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'status' => 'active',
        'price_paid' => '100.00',
        'discount' => '0.00',
    ]);
    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '100.00',
        'status' => 'paid',
    ]);

    $seller = Employee::factory()->create();
    $coach = Employee::factory()->create();
    createCommission($addon, $seller, 'subscription_addon_sale', '10.00');
    createCommission($addon, $coach, 'subscription_addon_coach', '20.00');

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/addons/{$addon->id}/cancel", [
        'refund_amount' => '50.00',
    ])->assertOk();

    $this->assertDatabaseHas('commissions', [
        'source_type' => SubscriptionAddon::class,
        'source_id' => $addon->id,
        'employee_id' => $seller->id,
        'commission_type' => 'subscription_addon_sale_refund',
        'amount' => -5,
    ]);
    $this->assertDatabaseHas('commissions', [
        'source_type' => SubscriptionAddon::class,
        'source_id' => $addon->id,
        'employee_id' => $coach->id,
        'commission_type' => 'subscription_addon_coach_refund',
        'amount' => -10,
    ]);
});

test('refund of an already paid commission schedules recovery after a paid payroll month', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $subscription = Subscription::factory()->active()->create([
        'start_date' => '2026-06-10',
        'price_paid' => '300.00',
        'cancellation_grace_days' => 2,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);
    $employee = Employee::factory()->create();
    createCommission($subscription, $employee, 'subscription_sale', '30.00', 'paid');
    Payroll::factory()->paid()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel")
        ->assertOk();

    $this->assertDatabaseHas('commissions', [
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'employee_id' => $employee->id,
        'commission_type' => 'subscription_sale_refund',
        'amount' => -30,
        'month' => '2026-07',
        'status' => 'pending',
    ]);
});

test('refund cannot race a delayed commission calculation', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $sellerUser = User::factory()->create();
    $seller = Employee::factory()->create(['user_id' => $sellerUser->id]);
    $plan = Plan::factory()->active()->create([
        'commission_rate' => '0.1000',
        'cancellation_grace_days' => 2,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'plan_id' => $plan->id,
        'sold_by_user_id' => $sellerUser->id,
        'start_date' => '2026-06-10',
        'price_paid' => '300.00',
        'cancellation_grace_days' => 2,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    // Simulate the live queue not having persisted its commission yet.
    Commission::query()->where('source_type', Subscription::class)->where('source_id', $subscription->id)->delete();

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel")
        ->assertOk();

    $this->assertDatabaseHas('commissions', [
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'employee_id' => $seller->id,
        'commission_type' => 'subscription_sale',
        'amount' => 30,
    ]);
    $this->assertDatabaseHas('commissions', [
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'employee_id' => $seller->id,
        'commission_type' => 'subscription_sale_refund',
        'amount' => -30,
    ]);
    expect((string) Commission::query()
        ->where('source_type', Subscription::class)
        ->where('source_id', $subscription->id)
        ->sum('amount'))->toBe('0');
});

function createCommission(
    Subscription|SubscriptionAddon $source,
    Employee $employee,
    string $type,
    string $amount,
    string $status = 'pending',
): Commission {
    return Commission::query()->create([
        'employee_id' => $employee->id,
        'source_type' => get_class($source),
        'source_id' => $source->id,
        'commission_type' => $type,
        'calculation_type' => 'percentage',
        'rate' => '0.1000',
        'rule_value' => '10.0000',
        'amount' => $amount,
        'month' => '2026-06',
        'status' => $status,
    ]);
}
