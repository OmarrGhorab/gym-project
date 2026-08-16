<?php

namespace App\Console\Commands;

use App\Actions\Reports\SendDailyReport;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Throwable;

class SendDailyReportCommand extends Command
{
    protected $signature = 'reports:send-daily
        {--date= : Business date in YYYY-MM-DD format (defaults to the working day that just ended)}
        {--force : Send again even if this day was already reported}';

    protected $description = 'Build and send the admin daily report — the day\'s money, who handled it, the shifts and staff attendance.';

    public function handle(SendDailyReport $action): int
    {
        $date = null;
        $requested = $this->option('date');

        if (is_string($requested) && $requested !== '') {
            try {
                $date = Carbon::createFromFormat('Y-m-d', $requested)->startOfDay();
            } catch (Throwable) {
                $this->error('The --date option must use YYYY-MM-DD.');

                return self::FAILURE;
            }
        }

        $result = $action->handle($date, force: (bool) $this->option('force'));
        $this->info("Daily report {$result['reason']} for {$result['business_date']}.");

        return self::SUCCESS;
    }
}
