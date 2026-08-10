<?php

use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const REVERSAL_REASON = 'First check-in reversed after a duplicate scan was submitted for review.';

function runVisitRepair(): void
{
    $migration = require database_path('migrations/2026_08_09_120000_repair_duplicate_scan_member_visits.php');
    $migration->up();
}

/** @param array<int, array{0: string, 1: ?string, 2: string, 3: ?string}> $rows */
function seedVisits(Member $member, Subscription $subscription, array $rows): void
{
    foreach ($rows as [$in, $out, $status, $reason]) {
        MemberVisit::query()->create([
            'member_id' => $member->id,
            'subscription_id' => $subscription->id,
            'check_in_at' => $in,
            'check_out_at' => $out,
            'status' => $status,
            'alert_reason' => $reason,
        ]);
    }
}

function countedOn(Member $member, string $day): int
{
    return MemberVisit::query()
        ->where('member_id', $member->id)
        ->whereIn('status', ['allowed', 'flagged'])
        ->whereBetween('check_in_at', [$day.' 00:00:00', $day.' 23:59:59'])
        ->count();
}

test('a burst of reversed scans collapses to a single visit for the day', function (): void {
    $member = Member::factory()->create();
    $subscription = Subscription::factory()->for($member)->active()->create();

    // The shape the old code produced: each row closed the moment the next fired,
    // and the last scan was never decided on.
    seedVisits($member, $subscription, [
        ['2026-08-09 18:20:59', '2026-08-09 18:21:10', 'flagged', REVERSAL_REASON],
        ['2026-08-09 18:21:10', '2026-08-09 18:23:35', 'flagged', REVERSAL_REASON],
        ['2026-08-09 18:23:35', '2026-08-09 18:26:21', 'flagged', REVERSAL_REASON],
        ['2026-08-09 18:26:21', null, 'pending_review', 'Duplicate check-in'],
    ]);

    expect(countedOn($member, '2026-08-09'))->toBe(3);

    runVisitRepair();

    // The member turned up once that evening, so the day counts once — and it is
    // the first scan that survives, because that is when they actually arrived.
    expect(countedOn($member, '2026-08-09'))->toBe(1);

    $survivor = MemberVisit::query()->where('member_id', $member->id)->where('status', 'allowed')->sole();
    expect($survivor->check_in_at->format('H:i:s'))->toBe('18:20:59');
});

test('a day that still has a real visit does not resurrect any reversal', function (): void {
    $member = Member::factory()->create();
    $subscription = Subscription::factory()->for($member)->active()->create();

    seedVisits($member, $subscription, [
        ['2026-08-09 18:20:00', '2026-08-09 18:21:00', 'flagged', REVERSAL_REASON],
        ['2026-08-09 18:21:00', '2026-08-09 18:23:00', 'flagged', REVERSAL_REASON],
        // The desk approved this one, so the day already has its attendance.
        ['2026-08-09 19:48:00', null, 'allowed', null],
    ]);

    runVisitRepair();

    expect(countedOn($member, '2026-08-09'))->toBe(1);

    $survivor = MemberVisit::query()->where('member_id', $member->id)->where('status', 'allowed')->sole();
    expect($survivor->check_in_at->format('H:i:s'))->toBe('19:48:00');
});

test('a stranded pending review is resolved and a genuine flagged visit is left alone', function (): void {
    $member = Member::factory()->create();
    $subscription = Subscription::factory()->for($member)->active()->create();

    seedVisits($member, $subscription, [
        // Closed while still pending — the bug this repairs.
        ['2026-08-08 10:00:00', '2026-08-08 11:00:00', 'pending_review', 'Duplicate check-in'],
        // A geofence alert is a real visit and must keep counting.
        ['2026-08-08 12:00:00', '2026-08-08 13:00:00', 'flagged', 'Visit location is outside the configured gym geofence.'],
    ]);

    runVisitRepair();

    expect(MemberVisit::query()->where('member_id', $member->id)->where('status', 'pending_review')->count())->toBe(0)
        ->and(countedOn($member, '2026-08-08'))->toBe(1);
});
