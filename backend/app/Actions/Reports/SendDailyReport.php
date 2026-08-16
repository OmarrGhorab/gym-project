<?php

namespace App\Actions\Reports;

use App\Models\DailyReport;
use App\Services\OperationalNotifier;
use App\Support\BusinessDay;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Renders and sends the day's report once, after the working day has closed.
 *
 * Defaults to the day that just ended rather than the one in progress: the job
 * runs at 05:15, minutes after the 05:00 boundary, so "today" would be a day
 * five hours old and the night shift's takings would be missing from it.
 */
class SendDailyReport
{
    public function __construct(
        private readonly BuildDailyReport $builder,
        private readonly RenderDailyReportPdf $pdf,
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * @return array{sent: bool, reason: string, business_date: string, file_path: string|null}
     */
    public function handle(?Carbon $businessDate = null, ?Carbon $now = null, bool $force = false): array
    {
        $now ??= Carbon::now();
        $date = $businessDate?->toDateString() ?? BusinessDay::previous($now);

        $record = DB::transaction(function () use ($date, $force): ?DailyReport {
            $report = DailyReport::query()->lockForUpdate()->whereDate('business_date', $date)->first()
                ?? DailyReport::query()->create(['business_date' => $date]);

            // Already sent: a second scheduler tick, or a manual re-run, must not
            // put the same day in the bell twice.
            return $report->sent_at !== null && ! $force ? null : $report;
        });

        if (! $record) {
            return ['sent' => false, 'reason' => 'already_sent', 'business_date' => $date, 'file_path' => null];
        }

        $data = $this->builder->handle($date);
        $path = $this->store($date, $data);

        $this->notifier->dailyReport($date, $data, $path);
        $record->update(['sent_at' => $now, 'file_path' => $path]);

        return ['sent' => true, 'reason' => 'sent', 'business_date' => $date, 'file_path' => $path];
    }

    /**
     * Keeping the PDF is a convenience, not a requirement — the page rebuilds
     * the same figures on demand — so a storage failure must not cost the gym
     * the notification that the day is ready.
     *
     * @param  array<string, mixed>  $data
     */
    private function store(string $date, array $data): ?string
    {
        $path = "daily-reports/daily-report-{$date}.pdf";

        try {
            Storage::disk($this->disk())->put($path, $this->pdf->handle($data));

            return $path;
        } catch (Throwable $e) {
            Log::warning('Daily report PDF could not be stored', [
                'business_date' => $date,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function disk(): string
    {
        return (string) config('export.disk', 'local');
    }
}
