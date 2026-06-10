<?php

use App\Jobs\FoundationProbeJob;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Queue;

// phpunit.xml sets QUEUE_CONNECTION=sync, so dispatched jobs run inline.
// We test two ways:
//   1. With Queue::fake() to assert the job was dispatched.
//   2. Without a fake, dispatching on the sync driver to confirm actual execution.

describe('FoundationProbeJob', function () {
    it('can be dispatched to the queue', function () {
        Queue::fake();

        FoundationProbeJob::dispatch();

        Queue::assertPushed(FoundationProbeJob::class);
    });

    it('completes synchronously on the sync driver without throwing', function () {
        // QUEUE_CONNECTION=sync in phpunit.xml — dispatch runs inline
        expect(function () {
            FoundationProbeJob::dispatchSync();
        })->not->toThrow(Throwable::class);
    });

    it('implements ShouldQueue', function () {
        expect(new FoundationProbeJob)->toBeInstanceOf(ShouldQueue::class);
    });
});
