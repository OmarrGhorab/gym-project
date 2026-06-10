<?php

namespace App\Actions\Foundation;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Probes each infrastructure subsystem and returns a readiness map.
 *
 * Returns an array keyed by subsystem name with a bool value:
 *   true  = subsystem is reachable and functional
 *   false = subsystem is configured but returned an error
 *
 * Design intent: this action is called from tests and potentially from a
 * health/readiness endpoint in a later phase. It must never throw — failures
 * are captured and returned as false so callers get a complete picture.
 *
 * Constitution compliance:
 *   - Transport-agnostic: no HTTP request dependency.
 *   - Uses Laravel cache and storage facades (native features first).
 *   - Logs failures with structured context; never logs secrets.
 */
class CheckInfrastructureReadiness
{
    /**
     * Run all readiness probes and return their results.
     *
     * @return array{cache: bool, storage: bool, queue: bool, broadcast: bool}
     */
    public function check(): array
    {
        return [
            'cache' => $this->checkCache(),
            'storage' => $this->checkStorage(),
            'queue' => $this->checkQueue(),
            'broadcast' => $this->checkBroadcast(),
        ];
    }

    /**
     * Verifies the configured cache driver accepts a write and returns the value.
     * In tests this is the 'array' driver (phpunit.xml); in production it is Redis.
     */
    private function checkCache(): bool
    {
        try {
            $probe = 'foundation.readiness.probe';
            Cache::put($probe, 'ok', 30);
            $result = Cache::get($probe) === 'ok';
            Cache::forget($probe);

            return $result;
        } catch (Throwable $e) {
            Log::warning('Infrastructure readiness: cache probe failed.', [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Verifies the local disk can write and read a temporary probe file.
     * Storage::fake() in tests swaps the disk transparently.
     */
    private function checkStorage(): bool
    {
        try {
            $path = 'foundation/readiness-probe.txt';
            Storage::disk('local')->put($path, 'ok');
            $result = Storage::disk('local')->get($path) === 'ok';
            Storage::disk('local')->delete($path);

            return $result;
        } catch (Throwable $e) {
            Log::warning('Infrastructure readiness: storage probe failed.', [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Queue readiness is proven by the FoundationProbeJob test (QueueProbeTest).
     * Here we report true if the configured driver name is resolvable — a basic
     * configuration sanity check without dispatching a job inline.
     */
    private function checkQueue(): bool
    {
        try {
            $driver = config('queue.default');

            return is_string($driver) && strlen($driver) > 0;
        } catch (Throwable $e) {
            Log::warning('Infrastructure readiness: queue config check failed.', [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Broadcast readiness verifies that a broadcast connection is configured.
     * In tests BROADCAST_CONNECTION=null (phpunit.xml), which is a safe/valid driver.
     */
    private function checkBroadcast(): bool
    {
        try {
            $connection = config('broadcasting.default');

            return is_string($connection) && strlen($connection) > 0;
        } catch (Throwable $e) {
            Log::warning('Infrastructure readiness: broadcast config check failed.', [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
