<?php

use App\Actions\Payments\RecordPayment;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionRefund;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('admin can access classes plans report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/classes-plans')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['active_members', 'expired_members', 'expiring_soon', 'new_subscriptions_period', 'total_revenue_period'],
                'plans_summary',
                'subscriptions',
            ],
        ]);
});

test('admin can access products finance report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/products-finance')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['total_pos_revenue', 'total_orders', 'total_units_sold', 'low_stock_products_count'],
                'products_summary',
                'transactions',
            ],
        ]);
});

test('products finance report returns itemized sales details for a product', function (): void {
    $user = User::factory()->create(['name' => 'Cashier']);
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->create([
        'email' => 'buyer@example.com',
        'name' => 'Buyer One',
        'phone' => '01000000000',
    ]);
    $product = Product::factory()->create(['cost' => '10.00', 'name' => 'Electrolyte Water']);
    $sale = Sale::factory()->create([
        'created_at' => '2026-06-15 12:00:00',
        'discount' => '20.00',
        'member_id' => $member->id,
        'payment_method' => 'cash',
        'sold_by_user_id' => $user->id,
        'subtotal' => '100.00',
        'total' => '80.00',
    ]);
    SaleItem::factory()->create([
        'product_id' => $product->id,
        'quantity' => 2,
        'sale_id' => $sale->id,
        'total' => '50.00',
        'unit_price' => '25.00',
    ]);

    $response = $this->getJson("/api/v1/reports/products-finance?product_id={$product->id}&from=2026-06-01&to=2026-06-30")
        ->assertOk();

    expect($response->json('data.product_sales'))->toHaveCount(1)
        ->and($response->json('data.product_sales.0'))->toMatchArray([
            'allocated_discount' => '10.00',
            'member_email' => 'buyer@example.com',
            'member_name' => 'Buyer One',
            'net_received' => '40.00',
            'net_profit' => '20.00',
            'quantity' => 2,
            'seller_name' => 'Cashier',
        ]);
});

test('admin can access subs shifts report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/subs-shifts')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['total_shifts_count', 'total_subscription_revenue', 'total_pos_revenue', 'total_shift_revenue', 'total_cash_discrepancy'],
                'shifts',
            ],
        ]);
});

test('admin can access income outcome report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/income-outcome')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['subscription_income', 'pos_income', 'other_income', 'total_income', 'expenses_outcome', 'payroll_outcome', 'refunds_outcome', 'total_outcome', 'net_profit', 'profit_margin'],
                'timeline',
            ],
        ]);
});

test('income outcome does not count paid payroll twice when its expense ledger row exists', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    Payroll::factory()->create([
        'net_salary' => '500.00',
        'paid_at' => '2026-07-28 10:00:00',
        'status' => 'paid',
    ]);
    DB::table('expenses')->insert([
        'amount' => '500.00',
        'category' => 'payroll',
        'created_at' => '2026-07-28 10:00:00',
        'created_by' => $user->id,
        'date' => '2026-07-28',
        'description' => 'Payroll ledger row.',
    ]);
    DB::table('expenses')->insert([
        'amount' => '125.00',
        'category' => 'utilities',
        'created_at' => '2026-07-28 10:00:00',
        'created_by' => $user->id,
        'date' => '2026-07-28',
        'description' => 'Electricity bill.',
    ]);

    $response = $this->getJson('/api/v1/reports/income-outcome?from=2026-07-28&to=2026-07-28');
    $response
        ->assertOk()
        ->assertJsonPath('data.totals.expenses_outcome', '125.00')
        ->assertJsonPath('data.totals.payroll_outcome', '500.00')
        ->assertJsonPath('data.totals.total_outcome', '625.00')
        ->assertJsonPath('data.timeline.0.expenses_outcome', '125.00')
        ->assertJsonPath('data.timeline.0.payroll_outcome', '500.00')
        ->assertJsonPath('data.timeline.0.total_outcome', '625.00');
});

test('income outcome counts a refund once instead of netting it off income and subtracting it again', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '1000.00']);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'stopped',
        'price_paid' => '1000.00',
    ]);

    Payment::create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '1000.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-07-28 10:00:00',
    ]);
    // A cancellation writes BOTH a negative payment row and a refund row for the
    // same money; income must stay gross so the refund is only deducted once.
    Payment::create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '-400.00',
        'method' => 'cash',
        'status' => Payment::STATUS_REFUNDED,
        'paid_at' => '2026-07-28 11:00:00',
    ]);
    SubscriptionRefund::create([
        'subscription_id' => $subscription->id,
        'amount' => '400.00',
        'method' => 'cash',
        'reason' => 'cancelled',
        'refunded_at' => '2026-07-28 11:00:00',
        'created_by' => $user->id,
    ]);

    $this->getJson('/api/v1/reports/income-outcome?from=2026-07-28&to=2026-07-28')
        ->assertOk()
        ->assertJsonPath('data.totals.subscription_income', '1000.00')
        ->assertJsonPath('data.totals.refunds_outcome', '400.00')
        ->assertJsonPath('data.totals.net_profit', '600.00')
        ->assertJsonPath('data.timeline.0.net_profit', '600.00');
});

test('classes plans period revenue includes extra services sold with the membership', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '800.00']);
    $extraPlan = Plan::factory()->active()->create(['price' => '2500.00', 'category' => 'personal_training']);
    $coach = Employee::factory()->create(['role' => 'coach']);

    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'active',
        'price_paid' => '800.00',
        'created_at' => '2026-07-28 10:00:00',
    ]);
    $addon = SubscriptionAddon::create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $extraPlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-07-28',
        'end_date' => '2026-08-28',
        'status' => 'active',
        'price_paid' => '2500.00',
        'discount' => '0.00',
        'sold_by_user_id' => $user->id,
        'created_by' => $user->id,
    ]);
    // created_at is not fillable, so stamp the sale date the report groups on.
    $addon->forceFill(['created_at' => '2026-07-28 10:00:00'])->save();

    $response = $this->getJson('/api/v1/reports/classes-plans?from=2026-07-28&to=2026-07-28')
        ->assertOk()
        // 800 main + 2500 extra — the extra used to be dropped entirely.
        ->assertJsonPath('data.totals.total_revenue_period', '3300.00');

    $extraRow = collect($response->json('data.plans_summary'))->firstWhere('id', $extraPlan->id);

    expect($extraRow['revenue_period'])->toBe('2500.00')
        ->and($extraRow['new_subscriptions_period'])->toBe(1);
});

test('subs shifts report accounts for money taken while no shift was open', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '900.00']);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'active',
        'price_paid' => '900.00',
    ]);

    // No shift session exists for this window at all — this money used to vanish
    // from the report entirely rather than showing as unattributed.
    Payment::create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '900.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-07-28 13:00:00',
        'shift_session_id' => null,
    ]);

    $this->getJson('/api/v1/reports/subs-shifts?from=2026-07-28&to=2026-07-28')
        ->assertOk()
        ->assertJsonPath('data.totals.total_shifts_count', 0)
        ->assertJsonPath('data.totals.total_shift_revenue', '0.00')
        ->assertJsonPath('data.totals.unassigned_revenue', '900.00')
        ->assertJsonPath('data.totals.unassigned_subscription_revenue', '900.00')
        ->assertJsonPath('data.totals.unassigned_payments_count', 1)
        // The number that must always reflect every payment in the window.
        ->assertJsonPath('data.totals.total_period_revenue', '900.00')
        ->assertJsonPath('data.unassigned.total_revenue', '900.00');
});

test('a payment taken during an open shift is attributed to that shift and not to the unassigned bucket', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '900.00']);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'active',
        'price_paid' => '900.00',
    ]);

    $session = ShiftSession::create([
        'employee_shift_id' => EmployeeShift::factory()->create()->id,
        'business_date' => '2026-07-28',
        'status' => ShiftSession::STATUS_OPEN,
        'opened_by' => $user->id,
        'opened_at' => '2026-07-28 09:00:00',
        'closed_at' => null,
        'opening_float' => '0.00',
    ]);

    // RecordPayment stamps the open session, so this lands on the shift row.
    app(RecordPayment::class)->handle($subscription, [
        'amount' => '900.00',
        'method' => 'cash',
        'paid_at' => '2026-07-28 13:00:00',
    ], $user);

    $this->getJson('/api/v1/reports/subs-shifts?from=2026-07-28&to=2026-07-28')
        ->assertOk()
        ->assertJsonPath('data.totals.total_shifts_count', 1)
        ->assertJsonPath('data.shifts.0.id', $session->id)
        ->assertJsonPath('data.shifts.0.subscription_sales_amount', '900.00')
        ->assertJsonPath('data.totals.total_shift_revenue', '900.00')
        ->assertJsonPath('data.totals.unassigned_revenue', '0.00')
        ->assertJsonPath('data.totals.total_period_revenue', '900.00');
});
