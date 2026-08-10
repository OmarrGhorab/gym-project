<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Repair visits left behind by the old duplicate-scan handling.
 *
 * That code reversed a member's open visit every time they scanned again, so a
 * burst of scans at the door left a chain of rows like:
 *
 *     18:20 → 18:21   reversed
 *     18:21 → 18:23   reversed
 *     18:23 → 18:26   reversed
 *
 * which is one arrival scanned four times, not three visits. Because "visits this
 * month" counts flagged rows, every one of those inflated the member's tally.
 *
 * The repair, in order:
 *
 * 1. Every reversal stops counting — each was superseded seconds later by the
 *    scan that reversed it.
 * 2. Any day that would then have no attendance at all gets its earliest reversal
 *    restored, because the member did turn up; that first scan is when they
 *    arrived. This is what makes a burst collapse to one visit rather than none.
 * 3. Scans left pending review but already closed — stranded by a since-fixed bug
 *    in the approve path — are recorded as not counted. Nobody decided on them and
 *    nobody can now.
 *
 * Sessions are deliberately not re-charged. Those refunds happened days ago and
 * members have trained against the balances since; quietly taking sessions back
 * would be a worse error than the one being corrected. Attendance history is
 * repaired, balances are left where the gym and its members believe they are.
 *
 * IRREVERSIBLE: the original status of each row is not recorded, so down() cannot
 * restore it.
 */
return new class extends Migration
{
    private const REVERSAL_REASON = 'First check-in reversed after a duplicate scan was submitted for review.';

    private const SUPERSEDED_REASON = 'Superseded by a later scan seconds afterwards; recorded as not counted.';

    public function up(): void
    {
        $reversals = DB::table('member_visits')
            ->where('status', 'flagged')
            ->where('alert_reason', self::REVERSAL_REASON)
            ->get(['id', 'member_id', 'check_in_at']);

        if ($reversals->isNotEmpty()) {
            DB::table('member_visits')
                ->whereIn('id', $reversals->pluck('id'))
                ->update(['status' => 'blocked', 'alert_reason' => self::SUPERSEDED_REASON]);
        }

        // Grouped in PHP rather than with a date() expression so the same migration
        // runs on MySQL in production and SQLite under test.
        $restored = 0;
        $byMemberAndDay = $reversals->groupBy(
            fn (object $row): string => $row->member_id.'|'.substr((string) $row->check_in_at, 0, 10),
        );

        foreach ($byMemberAndDay as $key => $rows) {
            [$memberId, $day] = explode('|', $key);

            $stillCounts = DB::table('member_visits')
                ->where('member_id', $memberId)
                ->whereIn('status', ['allowed', 'flagged'])
                ->whereBetween('check_in_at', [$day.' 00:00:00', $day.' 23:59:59'])
                ->exists();

            if ($stillCounts) {
                continue;
            }

            $earliest = $rows->sortBy('check_in_at')->first();

            DB::table('member_visits')
                ->where('id', $earliest->id)
                ->update(['status' => 'allowed', 'alert_reason' => null]);

            $restored++;
        }

        $stranded = DB::table('member_visits')
            ->where('status', 'pending_review')
            ->whereNotNull('check_out_at')
            ->update([
                'status' => 'blocked',
                'alert_reason' => 'Closed without a decision by an earlier defect; recorded as not counted.',
            ]);

        info('Repaired duplicate-scan member visits', [
            'reversals_stopped_counting' => $reversals->count(),
            'days_restored_to_one_visit' => $restored,
            'stranded_reviews_resolved' => $stranded,
        ]);
    }

    public function down(): void
    {
        // Intentionally empty — see the class docblock.
    }
};
