<?php

namespace App\Console\Commands;

use App\Actions\ShiftSessions\SendDailyShiftSummary;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Throwable;

class SendDailyShiftSummaryCommand extends Command
{
    protected $signature = 'shifts:send-daily-summary {--date= : Business date in YYYY-MM-DD format (defaults to the working day that just ended)}';

    protected $description = 'Send the once-daily administrator summary after every active shift has ended.';

    public function handle(SendDailyShiftSummary $action): int
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

        $result = $action->handle($date);
        $this->info("Daily shift summary {$result['reason']} for {$result['business_date']}.");

        return self::SUCCESS;
    }
}
