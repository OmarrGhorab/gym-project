<?php

use App\Support\AttendanceCode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Shorten attendance codes so the printed badge is scannable.
 *
 * The original codes carried a 16-character random part. Code128 spends about
 * 11 modules per character, which made the symbol roughly 310 modules wide —
 * far too wide to print at a module width a 1D laser can resolve, so badges
 * came out as a stretched banner. Six characters brings the symbol to ~123
 * modules, the proportions of an ordinary retail barcode.
 *
 * IRREVERSIBLE: the previous random codes are not recoverable, and `down()`
 * cannot restore them. Any badge printed from an old code stops resolving, so
 * badges must be reprinted after this runs.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['members' => 'member', 'employees' => 'employee'] as $table => $type) {
            $prefix = AttendanceCode::prefixFor($type);
            $taken = DB::table($table)->whereNotNull('attendance_code')->pluck('attendance_code')->all();
            $taken = array_flip($taken);

            DB::table($table)
                ->orderBy('id')
                ->select('id', 'attendance_code')
                ->chunkById(200, function ($rows) use ($table, $prefix, &$taken): void {
                    foreach ($rows as $row) {
                        // Codes already at the short length are left alone so the
                        // migration is safe to re-run against a partial rollout.
                        if ($row->attendance_code !== null
                            && strlen($row->attendance_code) === strlen($prefix) + AttendanceCode::RANDOM_LENGTH) {
                            continue;
                        }

                        do {
                            $code = $prefix.AttendanceCode::randomSuffix();
                        } while (isset($taken[$code]));

                        $taken[$code] = true;
                        DB::table($table)->where('id', $row->id)->update(['attendance_code' => $code]);
                    }
                });
        }
    }

    public function down(): void
    {
        // Intentionally empty: the superseded codes were random and are gone.
        // Rolling back would leave badges pointing at codes that never return.
    }
};
