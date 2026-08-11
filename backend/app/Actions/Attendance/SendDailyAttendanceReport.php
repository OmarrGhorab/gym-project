<?php

namespace App\Actions\Attendance;

use App\Models\DailyAttendanceReport;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Builds the day's attendance PDF, parks it on the export disk, and tells the
 * admins it is ready.
 *
 * The row in `daily_attendance_reports` is claimed inside a transaction so two
 * overlapping scheduler ticks cannot both notify for the same day.
 */
final class SendDailyAttendanceReport
{
    public function __construct(
        private readonly BuildDailyAttendanceReport $builder,
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * @return array{sent: bool, reason: string, business_date: string, file_path: string|null}
     */
    public function handle(?Carbon $businessDate = null, bool $force = false): array
    {
        $businessDate = ($businessDate ?? now())->copy()->startOfDay();
        $dateString = $businessDate->toDateString();

        $report = DB::transaction(function () use ($dateString, $force): ?DailyAttendanceReport {
            $report = DailyAttendanceReport::query()
                ->lockForUpdate()
                ->whereDate('business_date', $dateString)
                ->first();

            if (! $report) {
                $report = DailyAttendanceReport::query()->create(['business_date' => $dateString]);
            }

            if ($report->sent_at && ! $force) {
                return null;
            }

            // Stamp before the PDF work so a concurrent tick sees it as claimed.
            $report->update(['sent_at' => now()]);

            return $report;
        });

        if (! $report) {
            return [
                'sent' => false,
                'reason' => 'already_sent',
                'business_date' => $dateString,
                'file_path' => null,
            ];
        }

        $data = $this->builder->data($businessDate);
        $path = $this->builder->storagePath($businessDate);

        Storage::disk($this->disk())->put($path, $this->builder->pdf($businessDate));
        $report->update(['file_path' => $path]);

        $this->notifier->dailyAttendanceReport(
            businessDate: $dateString,
            totals: $data['totals'],
            downloadUrl: '/dashboard/attendance?report_date='.$dateString,
        );

        return [
            'sent' => true,
            'reason' => 'sent',
            'business_date' => $dateString,
            'file_path' => $path,
        ];
    }

    private function disk(): string
    {
        return (string) config('export.disk', 'local');
    }
}
