<?php

use App\Actions\Reports\FinancialReport;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('financial report correctly reconciles revenue and expenses grouped by day', function (): void {
    $user = User::factory()->create();

    // Create paid payments (revenue)
    Payment::factory()->create([
        'payable_type' => 'subscription',
        'payable_id' => 1,
        'amount' => '150.00',
        'status' => 'paid',
        'paid_at' => Carbon::parse('2026-06-01 12:00:00'),
    ]);
    Payment::factory()->create([
        'payable_type' => 'subscription',
        'payable_id' => 1,
        'amount' => '250.00',
        'status' => 'paid',
        'paid_at' => Carbon::parse('2026-06-01 15:30:00'),
    ]);
    // Payment on another day
    Payment::factory()->create([
        'payable_type' => 'subscription',
        'payable_id' => 1,
        'amount' => '100.00',
        'status' => 'paid',
        'paid_at' => Carbon::parse('2026-06-02 10:00:00'),
    ]);
    // Unpaid payment (should be excluded)
    Payment::factory()->create([
        'payable_type' => 'subscription',
        'payable_id' => 1,
        'amount' => '500.00',
        'status' => 'due',
        'paid_at' => null,
    ]);

    // Create expenses
    Expense::factory()->create([
        'amount' => '50.00',
        'date' => '2026-06-01',
        'created_by' => $user->id,
    ]);
    Expense::factory()->create([
        'amount' => '80.00',
        'date' => '2026-06-02',
        'created_by' => $user->id,
    ]);
    Expense::factory()->create([
        'amount' => '20.00',
        'date' => '2026-06-03',
        'created_by' => $user->id,
    ]);

    $action = app(FinancialReport::class);
    $report = $action->execute([
        'from' => '2026-06-01',
        'to' => '2026-06-03',
        'group_by' => 'day',
    ]);

    expect($report['data'])->toHaveCount(3);

    // Day 1: Revenue = 400.00, Expenses = 50.00, Net = 350.00
    expect($report['data'][0]['period'])->toBe('2026-06-01');
    expect($report['data'][0]['revenue'])->toBe('400.00');
    expect($report['data'][0]['expenses'])->toBe('50.00');
    expect($report['data'][0]['net_profit'])->toBe('350.00');

    // Day 2: Revenue = 100.00, Expenses = 80.00, Net = 20.00
    expect($report['data'][1]['period'])->toBe('2026-06-02');
    expect($report['data'][1]['revenue'])->toBe('100.00');
    expect($report['data'][1]['expenses'])->toBe('80.00');
    expect($report['data'][1]['net_profit'])->toBe('20.00');

    // Day 3: Revenue = 0.00, Expenses = 20.00, Net = -20.00
    expect($report['data'][2]['period'])->toBe('2026-06-03');
    expect($report['data'][2]['revenue'])->toBe('0.00');
    expect($report['data'][2]['expenses'])->toBe('20.00');
    expect($report['data'][2]['net_profit'])->toBe('-20.00');

    // Totals
    expect($report['meta']['totals']['revenue'])->toBe('500.00');
    expect($report['meta']['totals']['expenses'])->toBe('150.00');
    expect($report['meta']['totals']['net_profit'])->toBe('350.00');
});

test('financial report correctly reconciles revenue and expenses grouped by month', function (): void {
    $user = User::factory()->create();

    // Month 1
    Payment::factory()->create([
        'payable_type' => 'subscription',
        'payable_id' => 1,
        'amount' => '1000.00',
        'status' => 'paid',
        'paid_at' => Carbon::parse('2026-05-15 12:00:00'),
    ]);
    Expense::factory()->create([
        'amount' => '400.00',
        'date' => '2026-05-20',
        'created_by' => $user->id,
    ]);

    // Month 2
    Payment::factory()->create([
        'payable_type' => 'subscription',
        'payable_id' => 1,
        'amount' => '2000.00',
        'status' => 'paid',
        'paid_at' => Carbon::parse('2026-06-05 12:00:00'),
    ]);
    Expense::factory()->create([
        'amount' => '600.00',
        'date' => '2026-06-10',
        'created_by' => $user->id,
    ]);

    $action = app(FinancialReport::class);
    $report = $action->execute([
        'from' => '2026-05-01',
        'to' => '2026-06-30',
        'group_by' => 'month',
    ]);

    expect($report['data'])->toHaveCount(2);

    expect($report['data'][0]['period'])->toBe('2026-05');
    expect($report['data'][0]['revenue'])->toBe('1000.00');
    expect($report['data'][0]['expenses'])->toBe('400.00');
    expect($report['data'][0]['net_profit'])->toBe('600.00');

    expect($report['data'][1]['period'])->toBe('2026-06');
    expect($report['data'][1]['revenue'])->toBe('2000.00');
    expect($report['data'][1]['expenses'])->toBe('600.00');
    expect($report['data'][1]['net_profit'])->toBe('1400.00');

    expect($report['meta']['totals']['revenue'])->toBe('3000.00');
    expect($report['meta']['totals']['expenses'])->toBe('1000.00');
    expect($report['meta']['totals']['net_profit'])->toBe('2000.00');
});
