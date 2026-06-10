<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * A lightweight probe job used to verify that the queue infrastructure is
 * operational. It performs no side effects beyond logging its completion.
 *
 * Why a dedicated probe instead of a closure: named jobs appear in
 * failed_jobs, are observable via horizon/telescope, and can be retried —
 * meeting the Constitution's observability requirement for queued work (§VI).
 */
class FoundationProbeJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        // No business logic — this job's sole purpose is to prove the queue
        // processes work. Log at debug level so it's observable without noise.
        Log::debug('FoundationProbeJob: queue infrastructure probe completed.');
    }
}
