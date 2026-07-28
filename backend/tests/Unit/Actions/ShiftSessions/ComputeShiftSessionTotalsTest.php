<?php

use App\Actions\ShiftSessions\ComputeShiftSessionTotals;
use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

test('shift totals include subscription revenue pos refunds and expenses for the session window', function (): void {
    Carbon::setTestNow('2026-06-10 12:00:00');

    $user = User::factory()->create();
    $shift = EmployeeShift::factory()->create([
        'name' => 'Morning Shift',
        'is_active' => true,
    ]);
    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => '2026-06-10',
        'opened_at' => '2026-06-10 08:00:00',
        'opened_by' => $user->id,
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '100.00',
    ]);

    // Prefer explicit FK for membership collection.
    $subscription = Subscription::factory()->active()->create(['price_paid' => '950.00']);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '950.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-10 09:00:00',
        'shift_session_id' => $session->id,
    ]);

    // POS payment tagged to session.
    $sale = Sale::factory()->create(['total' => '80.00']);
    Payment::factory()->create([
        'payable_type' => Sale::class,
        'payable_id' => $sale->id,
        'amount' => '80.00',
        'method' => 'card',
        'status' => 'paid',
        'paid_at' => '2026-06-10 10:00:00',
        'shift_session_id' => $session->id,
    ]);

    // Untagged membership payment in window should be claimed.
    $subscription2 = Subscription::factory()->active()->create(['price_paid' => '200.00']);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription2->id,
        'amount' => '200.00',
        'method' => 'bank_transfer',
        'status' => 'paid',
        'paid_at' => '2026-06-10 11:00:00',
        'shift_session_id' => null,
    ]);

    // Refund during session.
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '-50.00',
        'method' => 'cash',
        'status' => 'refunded',
        'paid_at' => '2026-06-10 11:30:00',
        'shift_session_id' => $session->id,
    ]);

    Expense::query()->create([
        'category' => 'supplies',
        'amount' => '30.00',
        'date' => '2026-06-10 10:30:00',
        'created_by' => $user->id,
        'shift_session_id' => $session->id,
    ]);

    $totals = app(ComputeShiftSessionTotals::class)->handle($session);

    // cash payments: 950 - 50 = 900; + float 100 = 1000
    expect($totals['by_method']['cash'])->toBe('900.00')
        ->and($totals['cash'])->toBe('1000.00')
        ->and($totals['card'])->toBe('80.00')
        ->and($totals['bank'])->toBe('200.00')
        ->and($totals['by_source']['subscriptions'])->toBe('1100.00') // 950 + 200 - 50
        ->and($totals['by_source']['pos'])->toBe('80.00')
        ->and($totals['by_source']['refunds'])->toBe('50.00')
        ->and($totals['expenses'])->toBe('30.00')
        ->and($totals['expense_count'])->toBe(1)
        ->and($totals['net'])->toBe('1250.00'); // 1000 + 80 + 200 - 30

    // Orphan payment should now be tagged.
    expect(
        Payment::query()
            ->where('payable_type', Subscription::class)
            ->where('payable_id', $subscription2->id)
            ->value('shift_session_id'),
    )->toBe($session->id);
});

test('an open shift does not claim money recorded outside its own time window', function (): void {
    Carbon::setTestNow('2026-06-10 12:00:00');

    $user = User::factory()->create();
    $shift = EmployeeShift::factory()->create();
    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => '2026-06-10',
        'opened_at' => '2026-06-10 11:00:00',
        'opened_by' => $user->id,
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '0.00',
    ]);
    $subscription = Subscription::factory()->active()->create();
    $earlyPayment = Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '100.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-10 09:00:00',
        'shift_session_id' => null,
    ]);
    $latePayment = Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '50.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-10 11:30:00',
        'shift_session_id' => null,
    ]);
    $earlyExpense = Expense::factory()->create([
        'created_by' => $user->id,
        'amount' => '20.00',
        'created_at' => '2026-06-10 09:00:00',
        'updated_at' => '2026-06-10 09:00:00',
        'shift_session_id' => null,
    ]);

    $totals = app(ComputeShiftSessionTotals::class)->handle($session);

    expect($totals['collections'])->toBe('50.00')
        ->and(Payment::find($earlyPayment->id)->shift_session_id)->toBeNull()
        ->and(Payment::find($latePayment->id)->shift_session_id)->toBe($session->id)
        ->and(Expense::find($earlyExpense->id)->shift_session_id)->toBeNull();
});
