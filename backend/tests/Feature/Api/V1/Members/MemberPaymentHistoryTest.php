<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('member payment history returns subscription payments product purchases and totals', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $plan = Plan::factory()->create(['name' => 'Gold']);
    $subscription = Subscription::factory()->for($member)->for($plan)->create(['price_paid' => '500.00']);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    $sale = Sale::factory()->for($member)->create(['total' => '120.00']);
    SaleItem::factory()->for($sale)->for(Product::factory()->create(['name' => 'Water']))->create([
        'quantity' => 2,
        'unit_price' => '60.00',
        'total' => '120.00',
    ]);

    $this->getJson("/api/v1/members/{$member->id}/payment-history")
        ->assertOk()
        ->assertJsonPath('data.totals.subscription_paid', '300.00')
        ->assertJsonPath('data.totals.product_paid', '120.00')
        ->assertJsonPath('data.totals.outstanding_balance', '200.00')
        ->assertJsonCount(1, 'data.subscription_payments')
        ->assertJsonCount(1, 'data.product_purchases');
});
