<?php

namespace App\Console\Commands;

use App\Actions\ShiftSessions\AutoOpenScheduledShiftSessions;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

final class AutoOpenShiftSessions extends Command
{
    protected $signature = 'shifts:auto-open {--at= : Test or run at an explicit local datetime}';

    protected $description = 'Open the current scheduled shift desk automatically';

    public function handle(AutoOpenScheduledShiftSessions $action): int
    {
        $at = $this->option('at') ? Carbon::parse((string) $this->option('at')) : now();
        $result = $action->handle($at);

        $this->info("Opened {$result['opened']} scheduled shift session(s); skipped {$result['skipped']}.");

        return self::SUCCESS;
    }
}
