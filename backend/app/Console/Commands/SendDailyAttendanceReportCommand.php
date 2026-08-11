<?php

namespace App\Console\Commands;

use App\Actions\Attendance\SendDailyAttendanceReport;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Throwable;

class SendDailyAttendanceReportCommand extends Command
{
    protected $signature = 'attendance:send-daily-report
        {--date= : Business date in YYYY-MM-DD format (defaults to today)}
        {--force : Rebuild and re-send even if the report already went out}';

    protected $description = 'Build the daily staff attendance PDF and notify administrators.';

    public function handle(SendDailyAttendanceReport $action): int
    {
        $date = null;
        $requestedDate = $this->option('date');

        if (is_string($requestedDate) && $requestedDate !== '') {
            try {
                $date = Carbon::createFromFormat('Y-m-d', $requestedDate)->startOfDay();
            } catch (Throwable) {
                $this->error('The --date option must use YYYY-MM-DD.');

                return self::FAILURE;
            }
        }

        $result = $action->handle($date, (bool) $this->option('force'));
        $this->info("Daily attendance report {$result['reason']} for {$result['business_date']}.");

        return self::SUCCESS;
    }
}
