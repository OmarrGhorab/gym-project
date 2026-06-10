<?php

use App\Actions\Foundation\CheckInfrastructureReadiness;
use Illuminate\Support\Facades\Cache;

// phpunit.xml sets CACHE_STORE=array — so cache operations are in-memory.

describe('Cache readiness', function () {
    it('can write and read a cache value', function () {
        Cache::put('foundation.probe', 'ok', 60);

        expect(Cache::get('foundation.probe'))->toBe('ok');
    });

    it('reports cache as ready via CheckInfrastructureReadiness', function () {
        $action = new CheckInfrastructureReadiness;
        $result = $action->check();

        expect($result['cache'])->toBe(true);
    });

    it('cache miss returns null', function () {
        Cache::forget('foundation.probe');

        expect(Cache::get('foundation.probe'))->toBeNull();
    });
});
