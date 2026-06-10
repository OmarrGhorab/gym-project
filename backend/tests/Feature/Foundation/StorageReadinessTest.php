<?php

use App\Actions\Foundation\CheckInfrastructureReadiness;
use Illuminate\Support\Facades\Storage;

// Tests use the local disk (no external service required).
// Storage::fake() swaps the disk with a temporary in-memory filesystem.

describe('Storage readiness', function () {
    it('can write and read a file on the local disk', function () {
        Storage::fake('local');

        Storage::disk('local')->put('foundation/probe.txt', 'ok');

        expect(Storage::disk('local')->exists('foundation/probe.txt'))->toBeTrue()
            ->and(Storage::disk('local')->get('foundation/probe.txt'))->toBe('ok');
    });

    it('reports storage as ready via CheckInfrastructureReadiness', function () {
        Storage::fake('local');

        $action = new CheckInfrastructureReadiness;
        $result = $action->check();

        expect($result['storage'])->toBe(true);
    });

    it('confirms the remote-compatible disk is registered in config', function () {
        // Verifies that config/filesystems.php has the 'remote' disk key so
        // the storage layer can be pointed at S3-compatible storage later.
        $disks = array_keys(config('filesystems.disks'));

        expect($disks)->toContain('remote');
    });
});
