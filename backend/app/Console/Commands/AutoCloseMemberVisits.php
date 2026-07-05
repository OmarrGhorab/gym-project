<?php

namespace App\Console\Commands;

use App\Actions\MemberVisits\AutoCloseStaleMemberVisits;
use Illuminate\Console\Command;

class AutoCloseMemberVisits extends Command
{
    protected $signature = 'member-visits:auto-close';

    protected $description = 'Automatically check out open member visits after the maximum visit duration.';

    public function handle(AutoCloseStaleMemberVisits $autoCloseStaleVisits): int
    {
        $closed = $autoCloseStaleVisits->handle();

        $this->info("Auto-closed {$closed} member visit(s).");

        return self::SUCCESS;
    }
}
