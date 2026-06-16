<?php

use App\Models\Employee;
use App\Models\Expense;
use App\Models\Member;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Subscription;
use Database\Seeders\DatabaseSeeder;
use Spatie\Permission\Models\Role;

test('database seeder creates stable postman scenario records', function (): void {
    $this->seed(DatabaseSeeder::class);

    $member = Member::where('email', 'postman.member@gym.test')->first();
    $crudMember = Member::where('email', 'postman.member.crud@gym.test')->first();
    $plan = Plan::where('name', 'Postman Standard Monthly')->first();
    $subscription = Subscription::where('member_id', $member?->id)->where('plan_id', $plan?->id)->first();
    $product = Product::where('sku', 'POSTMAN-WHEY-1KG')->first();
    $sale = Sale::where('idempotency_key', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')->first();
    $employee = Employee::where('user_id', fn ($query) => $query->select('id')->from('users')->where('email', 'captain@gym.test'))->first();
    $expense = Expense::where('category', 'rent')->whereDate('date', '2026-06-10')->first();
    $payroll = Payroll::where('month', '2026-06')->first();
    $role = Role::where('name', 'Front Desk Lead')->first();

    expect($member)->not->toBeNull()
        ->and($crudMember)->not->toBeNull()
        ->and($member->status)->toBe('active')
        ->and($crudMember->status)->toBe('active')
        ->and($plan)->not->toBeNull()
        ->and($subscription)->not->toBeNull()
        ->and($product)->not->toBeNull()
        ->and($sale)->not->toBeNull()
        ->and($employee)->not->toBeNull()
        ->and($expense)->not->toBeNull()
        ->and($payroll)->not->toBeNull()
        ->and($role)->not->toBeNull();
});
